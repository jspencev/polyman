const thenify = require('thenify');
const glob = thenify(require('glob'));
const path = require('path');

export default async function findFileUpPath(cwd, filename) {
  const dirs = cwd.split('/');
  let fileDir;
  let filePath;
  for (let i = 0; i < dirs.length; i++) {
    let tryDir = cwd;
    for (let j = 0; j < i; j++) {
      tryDir = path.resolve(tryDir, '..');
    }
    const tryPath = path.resolve(tryDir, filename);
    const files = await glob(tryPath);
    if (files.length !== 0) {
      fileDir = tryDir;
      filePath = tryPath;
      break;
    }
  }

  return filePath;
}