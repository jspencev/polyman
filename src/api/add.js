const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { findRepository, findPackage, yarn, sortObject, fallback } from '../util';

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
    fallback(pack.dependencies, {}), 
    fallback(pack.devDependencies, {}), 
    fallback(pack.bundledDependencies, {})
  );
  projectDetails.dependencies = sortObject(projectDetails.dependencies);

  const newDependencies = {};
  const localDependencies = {};
  const localDevDeps = {};
  Object.keys(projectDetails.dependencies).map(function(dep) {
    const depVal = projectDetails.dependencies[dep];
    if (repo.projects[dep] && depVal.includes('file:')) {
      if (dev) {
        localDevDeps[dep] = depVal;
      } else {
        localDependencies[dep] = depVal;
      }
    } else {
      newDependencies[dep] = depVal;
    }
  });
  projectDetails.dependencies = newDependencies;
  projectDetails.local_dependencies = localDependencies;
  projectDetails.local_dev_dependencies = localDevDeps;

  repo.projects[projectName] = projectDetails;
  await fs.writeFile(repoPath, JSON.stringify(repo, null, 2));
}