const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { findRepository, yarn, generatePolymanDeps, cleanYarnLock } from '../../util';
import { findPackage } from '@carbon/node-util';

export default async function addRemove(dependencies, type, config, cwd) {
  await cleanYarnLock(cwd);

  const {repo, repoPath} = await findRepository(cwd);
  let {pack} = await findPackage(cwd);
  const projectName = pack.name;
  let projectDetails = repo.projects[projectName];
  if (!projectDetails) {
    throw Error(`We could not find project "${projectName}" in the repository file`);
  }

  let yarnCmd;
  if (type === 'add') {
    yarnCmd = ['add'];
    if (config.dev) {
      yarnCmd.push('--dev');
    } else if (config.peer) {
      yarnCmd.push('--peer');
    } else if (config.optional) {
      yarnCmd.push('--optional');
    }
    if (config.exact) {
      yarnCmd.push('--exact');
    } else if (config.tilde) {
      yarnCmd.push('--tilde');
    }
  } else if (type === 'remove') {
    yarnCmd = ['remove'];
  } else {
    throw Error ('Type must be "add" or "remove"');
  }

  yarnCmd = yarnCmd.concat(...dependencies);
  await yarn(yarnCmd, cwd);

  projectDetails = await generatePolymanDeps(repo, projectDetails);
  repo.projects[projectName] = projectDetails;
  await fs.writeFile(repoPath, JSON.stringify(repo, null, 2));

  await cleanYarnLock(cwd);
}