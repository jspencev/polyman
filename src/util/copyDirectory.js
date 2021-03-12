import { moveFile, isFile } from '@jspencev/node-util';
import path from 'path';
import thenify from 'thenify';
import _glob from 'glob';
const glob = thenify(_glob);

export default async function copyDirectory(from, to, filter) {
  const globPattern = path.join(from, '**', '*');
  let filesToCopy;
  if (filter) {
    if (typeof filter === 'function') {
      const res = await glob(globPattern, {
        dot: true
      });
      filesToCopy = [];
      for (const filepath of res) {
        if (await filter(filepath)) {
          filesToCopy.push(filepath);
        }
      }
    } else {
      filesToCopy = await glob(globPattern, filter);
    }
  } else {
    filesToCopy = await glob(globPattern, {
      dot: true
    });
  }

  for (const filepath of filesToCopy) {
    if (await isFile(filepath)) {
      const oldRel = path.relative(from, filepath);
      const newPath = path.resolve(to, oldRel);
      await moveFile(filepath, newPath, true);
    }
  }
}