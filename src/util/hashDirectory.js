const md5 = require('md5');
const path = require('path');
import thenify from 'thenify';
const glob = thenify(require('glob'));
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));

export default async function hashDirectory(dir, excludeDirs = []) {
  if (!path.isAbsolute(dir)) {
    throw Error(`Directory path must be absolute. Yours: ${dir}`);
  }
  
  let excPat = '';
  for (const e of excludeDirs) {
    excPat += e + '|';
  }
  if (excPat !== '') {
    excPat = `!(${excPat.slice(0, -1)})/`;
  }
  let pattern = path.join(dir, `${excPat}**/*.*`);
  let files = await glob(pattern);
  pattern = path.join(dir, '*.*');
  files = files.concat(await glob(pattern));

  let hash = '';
  for (const file of files) {
    hash += md5(await fs.readFile(file) + '');
  }
  hash = md5(hash);
  return hash;
}