import spawnChildProcess from './spawnChildProcess';

export default async function yarn(command) {
  if (typeof command === 'string') {
    command = command.split(' ');
  }
  if (command[0] === 'yarn') {
    command.shift();
  }
  const {code, signal} = await spawnChildProcess('yarn', command);
  if (code !== 0) {
    throw Error(`${code}: ${signal}`);
  }
}