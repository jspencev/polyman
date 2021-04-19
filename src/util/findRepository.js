import { findFileUpPath, readJSONFile } from '@jspencev/node-util';

export default async function findRepository(cwd) {
  const filePath = await findFileUpPath('repository.poly', cwd);

  if (!filePath) {
    throw Error('The repository.poly file was not found about your current directory. Only call polyman inside a polyman repository.');
  }

  const repo = await readJSONFile(filePath);
  return {repo, repoPath: filePath};
}