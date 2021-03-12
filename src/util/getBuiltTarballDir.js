import { getAppRootPath } from '@jspencev/node-util';
import path from 'path';

const DEFAULT_BUILT_DIR = './.poly/build';

/**
 * Gets the directory of tarballs built with polyman.
 * @param {String} projectDir - The project directory. Will correct to project directory if a sub-directory or file is submitted.
 * @returns {String} - Built tarball directory.
 */
export default async function getBuiltTarballDir(projectDir) {
  projectDir = await getAppRootPath(projectDir);
  const builtTarballDir = path.resolve(projectDir, DEFAULT_BUILT_DIR);
  return builtTarballDir;
}