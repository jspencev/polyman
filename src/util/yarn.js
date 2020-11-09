import { spawnChildProcess } from '@carbon/node-util';

/**
 * Helper method for launching a yarn process.
 * @param {Array<String>|String} command - The arguments to pass to yarn. If string, will be split by space into array.
 * @param {String} dir - Absolute path to directory in which to execute the yarn command.
 */
export default async function yarn(command, dir = process.cwd()) {
  if (typeof command === 'string') {
    command = command.split(' ');
  }
  if (command[0] === 'yarn') {
    command.shift();
  }
  const {code, signal} = await spawnChildProcess('yarn', command, {
    cwd: dir
  });
  if (code !== 0) {
    throw Error(`${code}: ${signal}`);
  }
}