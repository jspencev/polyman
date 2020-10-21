import { spawnChildProcess, findPackage } from '@carbon/node-util';
(async function() {
  const {pack} = await findPackage();
  const name = pack.name;
  await spawnChildProcess('yarn', ['global', 'remove', name]);
  await spawnChildProcess('yarn', ['global', 'add', `file:${__dirname}`]);
})();
