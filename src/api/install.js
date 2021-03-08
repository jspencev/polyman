import { yarn, deleteFromYarnCache, cleanYarnLock, findRepository } from '%/util'
import { findPackage } from '@jspencev/node-util';

export default async function install(config, cwd = process.cwd()) {
  const {repo} = await findRepository(cwd);
  const {pack} = await findPackage(cwd);
  const depName = `@${repo.name}/${pack.name}`;
  await deleteFromYarnCache();
  await cleanYarnLock(cwd);

  const yarnCmd = ['install'];
  if (config.production) {
    yarnCmd.push('--production');
  }
  await yarn(yarnCmd, cwd);

  await deleteFromYarnCache();
  await cleanYarnLock(cwd);
}