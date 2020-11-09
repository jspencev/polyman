import { getAppRootPath, writeFileIfNotExist } from '@carbon/node-util';
import findRepository from './findRepository';
const lockfile = require('@yarnpkg/lockfile')
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
const eol = require('eol');

/**
 * Deletes all @<REPO> references from the yarn lock file.
 * @param {String} cwd - Current working directory
 */
export default async function cleanYarnLock(cwd) {
  const appRootPath = await getAppRootPath(cwd);
  const yarnLockPath = path.join(appRootPath, 'yarn.lock');
  let lockStr = (await fs.readFile(yarnLockPath)).toString();
  lockStr = eol.lf(lockStr);
  const lock = lockfile.parse(lockStr)
  const yarnLock = lock.object;

  const {repo} = await findRepository(cwd);
  const scope = '@' + repo.name;
  let startedRepo = false;
  for (const rule in yarnLock) {
    if (rule.startsWith(scope)) {
      startedRepo = true;
      delete yarnLock[rule];
    } else {
      if (startedRepo || !rule.startsWith('@')) {
        break;
      }
    }
  }


  const newLock = lockfile.stringify(yarnLock);
  await writeFileIfNotExist(yarnLockPath, newLock);
}