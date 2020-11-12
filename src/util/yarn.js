import { spawnChildProcess } from '@carbon/node-util';
import deleteFromYarnCache from './deleteFromYarnCache';
import cleanYarnLock from './cleanYarnLock';

/**
 * Helper method for launching a yarn process.
 * @param {Array<String>|String} command - The arguments to pass to yarn. If string, will be split by space into array.
 * @param {String} cwd - Absolute path to directory in which to execute the yarn command.
 */
export default async function yarn(command, cwd = process.cwd()) {
  await deleteFromYarnCache();
  await cleanYarnLock(cwd);

  if (typeof command === 'string') {
    command = command.split(' ');
  }
  if (command[0] === 'yarn') {
    command.shift();
  }
  const {code, signal} = await spawnChildProcess('yarn', command, {
    cwd: cwd
  });

  await deleteFromYarnCache();
  await cleanYarnLock(cwd);

  if (code !== 0) {
    throw Error(`${code}: ${signal}`);
  }
}