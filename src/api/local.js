import { findRepository } from '../util';
import add from './add';
import remove from './remove';
import pack from './private/pack';

export default async function local(projects, nextCdm, config, cwd) {
  const {repo} = await findRepository(cwd);
  projects.map(function(project) {
    const projectDetails = repo.projects[project]
    if (!projectDetails) {
      throw Error( `Project "${project}" is not a project in this polyrepo`);
    }
  
    if (!projectDetails.local_path && !projectDetails.git_repository) {
      throw Error(`Project is not local and does not have a git repository. The project must have at least one.`);
    }
  
    if (!projectDetails.local_path) {
      throw Error('Cloning from git repository is not yet supported.');
    }
  });

  let deps = [];
  if (nextCdm === 'add') {
    for (const projectName of projects) {
      const project = repo.projects[projectName];
      const scopedName = `@${repo.name}/${projectName}`;
      let projectPath;
      if (config.pack) {
        projectPath = await pack(project, projectName, cwd);
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