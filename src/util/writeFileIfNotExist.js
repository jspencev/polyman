const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
const path = require('path');

/**
 * Write a file at a location. If the directory does not exist, it's created for you.
 * @param {String} file - Absolute path to the file.
 * @param {String|Buffer} data - Data to write.
 */
export default async function writeFileIfNotExist(file, data) {
  if (!path.isAbsolute(file)) {
    throw Error(`Path must be absolute. Yours: "${file}"`);
  }
  const parsed = path.parse(file);
  const fileDir = path.join(parsed.root, parsed.dir);
  await fs.mkdir(fileDir, {recursive: true});
  await fs.writeFile(file, data);
}