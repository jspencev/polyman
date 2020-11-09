const thenify = require('thenify');
const rimraf = thenify(require('rimraf'));
const glob = thenify(require('glob'));
const path = require('path');

export default async function deleteFromYarnCache(name) {
  if (process.env.YARN_CACHE_DIR) {
    if (name.charAt(0) === '@') {
      name = name.split('/').join('-');
    }
    const pattern = path.join(process.env.YARN_CACHE_DIR, `npm-${name}*`);
    const files = await glob(pattern);
    for (const file of files) {
      await rimraf(file);
    }

    try {
      await rimraf(path.join(process.env.YARN_CACHE_DIR, '.tmp'));
    } catch (e) {}
  }
}