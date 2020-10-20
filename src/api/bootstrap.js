import { findRepository, hashDirectory, findProjectByLocalPath } from '../util';
import { fallback } from '@carbon/util';
import { findPackage } from '@carbon/node-util';
import local from './local';
import build from './build';
const path = require('path');

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
      config.dev = false;
      await runLink(project, projectName, localDeps, repo, config);
      config.dev = true;
      await runLink(project, projectName, localDevDeps, repo, config);
    }
  }
}

async function runLink(project, projectName, deps, repo, config) {
  const toLink = [];
  for (const projectName in deps) {
    const localPath = repo.projects[projectName].local_path
    if (localPath) {
      if (config.force) {
        toLink.push(projectName);
      } else {
        const oldHash = deps[projectName];
        const newHash = await hashDirectory(localPath, ['node_modules']);
        if (oldHash !== newHash) {
          toLink.push(projectName);
        } else {
          console.log(`Skipping link for "${projectName}": links are already up to date.`);
        }
      }
    }
  }
  if (toLink.length > 0) {
    try {
      await local(toLink, 'remove', config, project.local_path);
      await local(toLink, 'add', config, project.local_path);
    } catch (e) {
      throw Error(`The project "${projectName}" does not exist at path "${project.local_path}"`);
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