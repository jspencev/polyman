const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { findRepository, findPackage, yarn } from '../util';

export default async function add(dependencies, dev = false) {
  const {repo, repoPath} = await findRepository();
  let {pack, packPath} = await findPackage();
  const projectName = pack.name;
  const projectDetails = repo.projects[projectName];
  if (!projectDetails) {
    throw Error(`We could not find project "${projectName}" in the repository file`);
  }

  let yarnCmd = ['add'];
  if (dev) {
    yarnCmd.push('--dev');
  }
  yarnCmd = yarnCmd.concat(...dependencies);
  await yarn(yarnCmd);

  ({pack, packPath} = await findPackage());
  projectDetails.dependencies = Object.assign(
    pack.dependencies, 
    pack.devDependencies, 
    pack.bundledDependencies
  );

  const newDependencies = {};
  Object.keys(projectDetails.dependencies)
    .sort()
    .forEach(function(v) {
      newDependencies[v] = projectDetails.dependencies[v];
    });
  projectDetails.dependencies = newDependencies;
  repo.projects[projectName] = projectDetails;
  await fs.writeFile(repoPath, JSON.stringify(repo, null, 2));
}