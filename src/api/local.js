import { findRepository, findPackage } from '../util';
import add from './add';
import remove from './remove';
import pack from './private/pack';

export default async function local(projects, nextCdm, config, cwd) {
  const {repo} = await findRepository(cwd);
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
      await remove(toStrip, cwd);
    } catch (e) {}
  }

  let deps = [];
  if (nextCdm === 'add') {
    for (const projectName of projects) {
      const project = repo.projects[projectName];
      const scopedName = `@${repo.name}/${projectName}`;
      let projectPath;
      if (config.pack) {
        projectPath = await pack(projectName, project, cwd);
      } else {
        projectPath = project.local_path;
      }
      deps.push(`${scopedName}@file:${projectPath}`);
    }
    await add(deps, config, cwd);
  } else if (nextCdm === 'remove') {
    projects.map(function(p) {
      deps.push(`@${repo.name}/${p}`);
    });
    await remove(deps, cwd);
  } else {
    throw Error('local command must be followed by either "add" or "remove"');
  }
}