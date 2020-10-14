import { findRepository, fallback, yarn, hashDirectory } from '../util';
import local from './local';

export default async function bootstrap(dev, cwd) {
  const {repo} = await findRepository(cwd);
  const projectNames = Object.keys(repo.projects);
  for (let i = 0; i < projectNames.length; i++) {
    const projectName = projectNames[i];
    const projectDetails  = repo.projects[projectName];
    if (projectDetails.local_path) {
      try {
        await yarn('build', projectDetails.local_path);
      } catch (e) {
        throw Error(`Project "${projectName}": build failed`);
      }
    }
  }

  for (let i = 0; i < projectNames.length; i++) {
    const project = repo.projects[projectNames[i]];
    if (project.local_path) {
      const toLink = [];
      const localDeps = JSON.parse(JSON.stringify(fallback(project.local_dependencies, {})));
      if (dev) {
        Object.assign(localDeps, JSON.parse(JSON.stringify(fallback(project.local_dev_dependencies, {}))));
      }
      for (const projectName in localDeps) {
        const localPath = repo.projects[projectName].local_path
        if (localPath) {
          const oldHash = localDeps[projectName];
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
          throw Error(`The project "${projectNames[i]}" does not exist at path "${project.local_path}"`);
        }
      }
    }
  }
}