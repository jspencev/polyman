const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import findFileUpPath from './findFileUpPath';

export default async function findRepository(cwd = process.cwd()) {
  const filePath = await findFileUpPath(cwd, 'repository.polyman');

  if (!filePath) {
    throw Error('The repository.polyman file was not found about your current directory. Only call polyman inside a polyman repository.');
  }

  const repo = JSON.parse(await fs.readFile(filePath));
  return {repo, repoPath: filePath};
}