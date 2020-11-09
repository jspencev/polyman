import { findRepository, findProjectByLocalPath } from '../util';
import { fallback } from '@carbon/util';
import { findPackage } from '@carbon/node-util';
import local from './local';
import build from './build';
const path = require('path');
const _ = require('lodash');

export default async function bootstrap(config, cwd) {
  console.warn('DO NOT EXIT THIS PROCESS!');
  console.warn('YOU COULD LOSE REFERENCE TO THE LOCAL DEPENDENCIES ON A PROJECT AND YOU WILL HAVE TO RE-ADD THEM MANUALLY!');

  const {repo} = await findRepository(cwd);
  let packPath;
  try {
    ({packPath} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    config.all = true;
  }
  
  const projectDir = path.parse(packPath).dir;
  const me = findProjectByLocalPath(repo, projectDir);
  const myProjectName = me.projectName;
  const myProject = me.project;
  let projectNames;
  if (config.bootstrap_round_2) {
    projectNames = config.bootstrap_round_2.failed;
  } else {
    projectNames = Object.keys(repo.projects);
  }

  if (!config.all) {
    let seen = {};
    seen[myProjectName] = true;
    seen = findMyDeps(seen, myProject, repo);
    projectNames = Object.keys(seen);
    projectNames = projectNames.reverse();
  }

  const failedBuilds = [];
  for (const projectName of projectNames) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      try {
        console.log(`Polyman: Building ${projectName}`);
        console.log('-----------------------------------------------------------------');
        await build(config, project.local_path);
      } catch (e) {
        if (config.bootstrap_round_2) {
          console.error(`Project "${projectName}": build failed.`);
        } else {
          console.warn(`Project "${projectName}": build failed. Retrying after linking.`);
        }
        failedBuilds.push(projectName);
      }
    }
  }

  for (const projectName of projectNames) {
    console.log(`Polyman: Relinking ${projectName}`);
    console.log('-----------------------------------------------------------------');
    const project = repo.projects[projectName];
    if (project.local_path) {
      const {localDeps, localDevDeps} = getDeps(project);
      const allDeps = _.merge({}, localDeps, localDevDeps);

      const depsToRemove = Object.keys(allDeps);
      if (depsToRemove.length > 0) {
        console.warn('DO NOT EXIT THIS PROCESS!');
        console.warn('YOU COULD LOSE REFERENCE TO THE LOCAL DEPENDENCIES ON A PROJECT AND YOU WILL HAVE TO RE-ADD THEM MANUALLY!');

        await local(depsToRemove, 'remove', config, project.local_path);

        const depsToAdd = Object.keys(localDeps);
        if (depsToAdd.length > 0) {
          config.dev = false;
          await local(depsToAdd, 'add', config, project.local_path);
        }
  
        const devDepsToAdd = Object.keys(localDevDeps);
        if (devDepsToAdd.length > 0) {
          config.dev = true;
          await local(devDepsToAdd, 'add', config, project.local_path);
        }
      }
    }
  }

  if (failedBuilds.length > 0) {
    if (!config.bootstrap_round_2) {
      console.log(`Polyman: Retrying failed builds....`);
      config.bootstrap_round_2 = {
        failed: failedBuilds
      };
      await bootstrap(config, cwd);
    } else {
      console.log(`Polyman: ${failedBuilds.length} builds still failing:`);
      for (const failed of failedBuilds) {
        console.log('  ' + failed);
      }
    }
  }
}

function getDeps(project) {
  const localDeps = JSON.parse(JSON.stringify(fallback(project.local_dependencies, {})));
  const localDevDeps = JSON.parse(JSON.stringify(fallback(project.local_dev_dependencies, {})));
  return {localDeps, localDevDeps};
}

function findMyDeps(seen, project, repo) {
  const {localDeps, localDevDeps} = getDeps(project);
  const projectNames = Object.assign({}, localDeps, localDevDeps);
  for (const projectName in projectNames) {
    if (!seen[projectName]) {
      seen[projectName] = true;
      const project = repo.projects[projectName];
      seen = findMyDeps(seen, project, repo);
    }
  }
  return seen;
}