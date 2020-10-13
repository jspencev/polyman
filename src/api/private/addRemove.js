const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { findRepository, findPackage, yarn, sortObject, fallback, delay } from '../../util';

export default async function addRemove(dependencies, dev, type, cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  let {pack, packPath} = await findPackage(cwd);
  const projectName = pack.name;
  const projectDetails = repo.projects[projectName];
  if (!projectDetails) {
    throw Error(`We could not find project "${projectName}" in the repository file`);
  }

  let yarnCmd;
  if (type === 'add') {
    yarnCmd = ['add'];
    if (dev) {
      yarnCmd.push('--dev');
    }
  } else if (type === 'remove') {
    yarnCmd = ['remove'];
  } else {
    throw Error ('Type must be "add" or "remove"');
  }

  yarnCmd = yarnCmd.concat(...dependencies);
  await yarn(yarnCmd, cwd);

  ({pack, packPath} = await findPackage(cwd));
  let newDeps = Object.assign(
    {},
    fallback(pack.dependencies, {}), 
    fallback(pack.devDependencies, {}), 
    fallback(pack.bundledDependencies, {})
  );
  newDeps = sortObject(newDeps);

  const newDependencies = {};
  const localDependencies = {};
  const localDevDeps = {};
  Object.keys(newDeps).map(function(dep) {
    const depVal = newDeps[dep];
    if (depVal.includes('file:') && dep.includes(`@${repo.name}`)) {
      const pname = dep.split('/')[1];
      if (repo.projects[pname]) {
        if (pack.dependencies[dep]) {
          localDependencies[dep] = depVal;
        } else if (pack.devDependencies[dep]) {
          localDevDeps[dep] = depVal;
        }
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