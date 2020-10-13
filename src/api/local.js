import { findRepository } from '../util';
import add from './add';
import remove from './remove';

export default async function local(projects, dev, nextCdm, cwd) {
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

  if (nextCdm === 'add') {
    const deps = [];
    projects.map(function(p) {
      const projectPath = repo.projects[p].local_path;
      deps.push(`file:${projectPath}`);
    });
    await add(deps, dev, cwd);
  } else if (nextCdm === 'remove') {
    await remove(projects, cwd);
  } else {
    throw Error('local command must be followed by either "add" or "remove"');
  }
}