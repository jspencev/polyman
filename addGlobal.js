import { spawnChildProcess } from '@carbon/node-util';
import { deleteFromYarnCache } from './src/util';

(async function() {
  await deleteFromYarnCache('polyman');
  await spawnChildProcess('yarn', ['global', 'add', `file:${__dirname}`]);
})();
