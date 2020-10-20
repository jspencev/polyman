import { yarn } from '../../util';
import { findPackage, getAppRootPath, moveFile } from '@carbon/node-util';
const thenify = require('thenify');
const glob = thenify(require('glob'));
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));


/**
 * Packs the specified dependency into a tarball in /.poly/dependencies inside the calling project.
 * @param {String} depName - Dependency name.
 * @param {*} depProject - Dependency project object.
 * @param {String} cwd - Current working directory.
 * @returns {String} - Absolute path of the generated tarball.
 */
export default async function pack(depName, depProject, cwd) {
  const appRootPath = await getAppRootPath(cwd);
  const tarballsToRemove = await glob(path.join(appRootPath, `./.poly/dependencies/${depName}*`));
  for (const tarballPath of tarballsToRemove) {
    await fs.unlink(tarballPath);
  }
  await yarn(`pack`, depProject.local_path);
  const depPack = (await findPackage(depProject.local_path)).pack;
  const depVersion = depPack.version;
  const filename = `${depName}-v${depVersion}.tgz`;
  const tarballPath = path.join(depProject.local_path, filename);
  const newTarballPath = path.join(appRootPath, `./.poly/dependencies/${filename}`);
  await moveFile(tarballPath, newTarballPath);
  return newTarballPath;
}