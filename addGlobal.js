import { deleteFromYarnCache, yarn, cleanYarnLock, readJSONFile, YARN_CMD } from '%/util';
import { build } from '%/api';
import { getAppRootPath, spawnChildProcess } from '@jspencev/node-util';
import path from 'path';

let repoName;
let yarnGlobalDir;

(async function() {
  const appRootPath = await getAppRootPath(__dirname);
  const polyConfig = await readJSONFile(path.join(appRootPath, 'config.poly'));
  repoName = polyConfig.repository_name;

  yarnGlobalDir = (await spawnChildProcess(YARN_CMD, 'global dir', {stdio: 'pipe'})).result;
  await clean();

  try {
    await yarn('global remove polyman');
  } catch (e) {}

  await clean();

  const {tarballPath} = await build();
  await yarn(`global add file:${tarballPath}`);

  await clean();
})();

async function clean() {
  await cleanYarnLock(yarnGlobalDir, repoName);
  await deleteFromYarnCache('polyman');
}
