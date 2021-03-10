import { isFile } from '@jspencev/node-util';
import { isOneTruthy } from '@jspencev/util';
import thenify from 'thenify';
const glob = thenify(require('glob'));
import path from 'path';
import md5 from 'md5';
import thenifyAll from 'thenify-all';
const fs = thenifyAll(require('fs'));
import ignore from 'ignore';

export default async function hashDirectory(dir) {
  let gitignore = await fs.readFile(path.resolve(dir, '.gitignore'));
  gitignore = gitignore.toString();
  gitignore = ignore().add(gitignore);

  if (!path.isAbsolute(dir)) {
    throw Error(`Directory path must be absolute. Yours: ${dir}`);
  }

  let files = await glob(path.join(dir, '**', '*'), {
    dot: true
  });
  const newFiles = [];
  for (const filepath of files) {
    const relFilepath = path.relative(dir, filepath);
    if (!isOneTruthy(
      gitignore.ignores(relFilepath),
      relFilepath.includes('.git')
    )) {
      newFiles.push(filepath);
    }
  }
  files = newFiles;

  let hash = '';
  for (const file of files) {
    if (await isFile(file)) {
      hash += md5(await fs.readFile(file) + '');
    }
  }
  hash = md5(hash);
  return hash;
}