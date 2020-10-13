const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import findFileUpPath from './findFileUpPath';

export default async function findPackage(cwd = process.cwd()) {
  const filePath = await findFileUpPath(cwd, 'package.json');

  if (!filePath) {
    throw Error('We could not find a package.json anywhere up your current directory');
  }

  const pack = JSON.parse(await fs.readFile(filePath));
  return {pack, packPath: filePath};
}