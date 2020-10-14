import { findRepository, findPackage, fallback, yarn, hashDirectory } from '../util';
import local from './local';
const path = require('path');

export default async function bootstrap(all, cwd) {
  const {repo} = await findRepository(cwd);
  let packPath
  try {
    ({packPath} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    all = true;
  }
  
  let projectNames = Object.keys(repo.projects);

  if (!all) {
    let projectName;
    let project;
    const projectDir = path.parse(packPath).dir;
    for (const pname of projectNames) {
      const p = repo.projects[pname];
      if (p.local_path === projectDir) {
        project = p;
        projectName = pname;
        break;
      }
    }

    let seen = {};
    seen[projectName] = true;
    seen = findMyDeps(seen, project, repo);
    projectNames = Object.keys(seen);
  }

  for (const projectName of projectNames) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      try {
        await yarn('build', project.local_path);
      } catch (e) {
        throw Error(`Project "${projectName}": build failed`);
      }
    }
  }

  for (const projectName of projectNames) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      const {localDeps, localDevDeps} = getDeps(project);
      await runLink(project, projectName, localDeps, repo, false);
      await runLink(project, projectName, localDevDeps, repo, true);
    }
  }
}

async function runLink(project, projectName, deps, repo, dev) {
  const toLink = [];
  for (const projectName in deps) {
    const localPath = repo.projects[projectName].local_path
    if (localPath) {
      const oldHash = deps[projectName];
      const newHash = await hashDirectory(localPath, ['node_modules']);
      if (oldHash !== newHash) {
        toLink.push(projectName);
      }
    }
  }
  if (toLink.length > 0) {
    try {
      await local(toLink, dev, 'add', project.local_path);
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