import { getDependenciesDir } from '%/util';
import thenify from 'thenify';
import _glob from 'glob';
const glob = thenify(_glob);
import path from 'path';

/**
 * Finds the local dependency tarball in the given project directory's dependency directory.
 * Will error if not found or if more than one is found.
 * @param {String} projectDir - Project directory to look for dependencies in. Should be absolute.
 * @param {String} localDep - Local dependency name to look for.
 * @returns {String} - Absolute path to the tarball.
 */
export default async function findInMyDependencies(projectDir, localDep) {
  const depDir = getDependenciesDir(projectDir);
  const globPattern = path.join(depDir, `${localDep}*`);
  const tarballs = await glob(globPattern);
  if (tarballs.length !== 1) {
    if (tarballs.length == 0) {
      throw Error(`Cannot find a tarball for "${localDep}" in ${depDir}`);
    } else {
      throw Error(`"${localDep}" has multiple dependency tarballs in ${depDir}. Make sure there is only one tarball per dependency.`);
    }
  }

  return tarballs[0];
}