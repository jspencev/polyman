import { getAppRootPath, writeFileIfNotExist } from '@jspencev/node-util';
import { readJSONFile } from '%/util';
import * as lockfile from '@yarnpkg/lockfile';
import path from 'path';
import thenifyAll from 'thenify-all';
import _fs from 'fs';
const fs = thenifyAll(_fs);
import eol from 'eol';

/**
 * Deletes all @<REPO> references from the yarn lock file.
 * @param {String} cwd - Current working directory
 * @param {String} repoName - Repository name to clear. Default from cwd config.poly
 */
export default async function cleanYarnLock(cwd, repoName) {
  let projectDir;
  try {
    projectDir = await getAppRootPath(cwd);
  } catch (e) {
    // package does not exist, abort
    return;
  }
  
  if (!repoName) {
    try {
      const polyConfig = await readJSONFile(path.join(projectDir, 'config.poly'));
      repoName = polyConfig.repository_name;
    } catch (e) {
      // poly.config does not exist, abort
      return;
    }
  }

  if (repoName.charAt(0) !== '@') {
    repoName = `@${repoName}`;
  }

  const yarnLockPath = path.join(projectDir, 'yarn.lock');
  let lockStr;
  try {
    lockStr = (await fs.readFile(yarnLockPath)).toString();
  } catch (e) {
    // lockfile does not exist or cannot be read
    return;
  }

  lockStr = eol.lf(lockStr);
  const lock = lockfile.parse(lockStr)
  const yarnLock = lock.object;
  let startedRepo = false;
  for (const rule in yarnLock) {
    if (rule.startsWith(repoName)) {
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