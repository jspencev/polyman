import { spawnChildProcess } from '@carbon/node-util';
const path = require('path');

const YARN_CMD = path.resolve(__dirname, '../../node_modules/.bin/yarn');

export default async function getYarnCacheDir() {
  const {result} = await spawnChildProcess(YARN_CMD, ['cache', 'dir'], {stdio: 'pipe'});
  return result;
}