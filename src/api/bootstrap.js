import { findRepository, fallback } from '../util';
import local from './local';

export default async function bootstrap(dev, cwd) {
  const {repo} = await findRepository();
  const projectNames = Object.keys(repo.projects);
  for (let i = 0; i < projectNames.length; i++) {
    const project = repo.projects[projectNames[i]];
    if (project.local_path) {
      const toLink = [];
      const localDeps = Object.assign({}, JSON.parse(JSON.stringify(project.local_dependencies)));
      if (dev) {
        Object.assign(localDeps, JSON.parse(JSON.stringify(project.local_dev_dependencies)));
      }
      Object.keys(localDeps).map(function(dep) {
        if (repo.projects[dep].local_path) {
          toLink.push(dep);
        }
      });
      if (toLink.length > 0) {
        await local(toLink, dev, 'add', project.local_path);
      }
    }
  }
}