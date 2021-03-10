import { getAppRootPath, writeFileIfNotExist } from '@jspencev/node-util';
import findRepository from './findRepository';
import lockfile from '@yarnpkg/lockfile';
import path from 'path';
import thenifyAll from 'thenify-all';
import _fs from 'fs';
const fs = thenifyAll(_fs);
import eol from 'eol';

/**
 * Deletes all @<REPO> references from the yarn lock file.
 * @param {String} cwd - Current working directory
 */
export default async function cleanYarnLock(cwd, repo) {
  try {
    let appRootPath;
    if (!repo) {
      ({repo} = await findRepository(cwd));
    }
    const scope = '@' + repo.name;
    try {
      appRootPath = await getAppRootPath(cwd);
    } catch (e) {
      // not inside polyman dir, assuming the file is at cwd
      appRootPath = cwd;
    }
    
    const yarnLockPath = path.join(appRootPath, 'yarn.lock');
    let lockStr = (await fs.readFile(yarnLockPath)).toString();
    lockStr = eol.lf(lockStr);
    const lock = lockfile.parse(lockStr)
    const yarnLock = lock.object;
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
  } catch (e) {}
}