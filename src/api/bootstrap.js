import { findRepository, findProjectByLocalPath } from '../util';
import { fallback } from '@carbon/util';
import { findPackage } from '@carbon/node-util';
import local from './local';
import build from './build';
const path = require('path');
const _ = require('lodash');

export default async function bootstrap(config, cwd) {
  const {repo} = await findRepository(cwd);
  let packPath;
  try {
    ({packPath} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    config.all = true;
  }
  
  let projectNames = Object.keys(repo.projects);

  if (!config.all) {
    const projectDir = path.parse(packPath).dir;
    const {projectName, project} = findProjectByLocalPath(repo, projectDir);
    let seen = {};
    seen[projectName] = true;
    seen = findMyDeps(seen, project, repo);
    projectNames = Object.keys(seen);
  }

  for (const projectName of projectNames) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      try {
        await build(config, project.local_path);
      } catch (e) {
        throw Error(`Project "${projectName}": build failed`);
      }
    }
  }

  for (const projectName of projectNames) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      const {localDeps, localDevDeps} = getDeps(project);
      const allDeps = _.merge({}, localDeps, localDevDeps);

      const depsToRemove = Object.keys(allDeps);
      if (depsToRemove.length > 0) {
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