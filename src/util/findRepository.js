import { findFileUpPath } from '@jspencev/node-util';
import { readJSONFile } from '%/util';

export default async function findRepository(cwd = process.cwd()) {
  const filePath = await findFileUpPath(cwd, 'repository.poly');

  if (!filePath) {
    throw Error('The repository.poly file was not found about your current directory. Only call polyman inside a polyman repository.');
  }

  const repo = await readJSONFile(filePath);
  return {repo, repoPath: filePath};
}