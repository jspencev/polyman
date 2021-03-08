import { findRepository, writeJSONToFile } from '../util';
import { findPackage } from '@jspencev/node-util';
import { isOneOf } from '@jspencev/util';
import add from './add';
import remove from './remove';
import _ from 'lodash';

export default async function local(projects, nextCmd, config, cwd) {
  if (!isOneOf(nextCmd, 'add', 'remove')) {
    throw Error('nextCmd must be one of "add" or "remove"');
  }

  let {repo, repoPath} = await findRepository(cwd);
  const myPackage = await findPackage(cwd);
  const myName = myPackage.pack.name;
  const toStrip = [];
  for (const projectName of projects) {
    const project = repo.projects[projectName]
    if (!project) {
      throw Error( `Project "${projectName}" is not a project in this polyrepo`);
    }
  
    if (!project.local_path && !project.git_repository) {
      throw Error(`Project is not local and does not have a git repository. The project must have at least one.`);
    }
  
    if (!project.local_path) {
      throw Error('Cloning from git repository is not yet supported.');
    }

    if (project.npm && repo.projects[myName].dependencies[project.npm]) {
      toStrip.push(project.npm);
    }
  }

  if (toStrip.length > 0) {
    console.log(`Stripping ${toStrip.join(' ')}...`);
    try {
      config.local = false;
      await remove(toStrip, config, cwd);
    } catch (e) {}
  }

  config.local = true;
  if (config.build) {
    config.dev = true;
  }

  if (nextCmd === 'add') {
    ({repo} = await add(projects, config, cwd));
    if (config.build) {
      const buildDeps = repo.projects[myName].build_dependencies;
      for (const projectName of projects) {
        if (!buildDeps.includes(projectName)) {
          buildDeps.push(projectName);
        }
      }
      buildDeps.sort();
      repo.projects[myName].build_dependencies = buildDeps;
      await writeJSONToFile(repoPath, repo);
    }
  } else {
    ({repo} = await remove(projects, config, cwd));
    _.pullAll(repo.projects[myName].build_dependencies, projects);
    await writeJSONToFile(repoPath, repo);
  }
}