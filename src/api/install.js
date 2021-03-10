import { yarn, deleteFromYarnCache, cleanYarnLock } from '%/util'

export default async function install(config, cwd = process.cwd()) {
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