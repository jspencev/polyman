import { findRepository, YARN_CMD } from '%/util'
import { doAllExist } from '@jspencev/util';
import { spawnChildProcess } from '@jspencev/node-util';
import thenify from 'thenify';
const rimraf = thenify(require('rimraf'));
const glob = thenify(require('glob'));
import path from 'path';

export default async function deleteFromYarnCache(name = null) {
  const yarnCacheDir = (await spawnChildProcess(YARN_CMD, ['cache', 'dir'], {stdio: 'pipe'})).result;
  if (yarnCacheDir) {
    if (doAllExist(name)) {
      if (name.charAt(0) === '@') {
        name = name.split('/').join('-');
      }
    } else {
      const {repo} = await findRepository();
      name = '@' + repo.name;
    }
    const pattern = path.join(yarnCacheDir, `npm-${name}*`);
    const files = await glob(pattern);
    for (const file of files) {
      await rimraf(file);
    }

    try {
      await rimraf(path.join(yarnCacheDir, '.tmp'));
    } catch (e) {
      // do nothing
    }
  }
}