import { findPackage, yarn, moveFile, getAppRootPath } from '../../util';
const path = require('path');

/**
 * Packs the specified dependency into a tarball in /.poly/dependencies inside the calling project.
 * @param {String} depName - Dependency name.
 * @param {*} depProject - Dependency project object.
 * @param {String} cwd - Current working directory.
 * @returns {String} - Absolute path of the generated tarball.
 */
export default async function pack(depName, depProject, cwd) {
  await yarn(`pack`, depProject.local_path);
  const depPack = (await findPackage(depProject.local_path)).pack;
  const depVersion = depPack.version;
  const filename = `${depName}-v${depVersion}.tgz`;
  const tarballPath = path.join(depProject.local_path, filename);
  const myPath = await getAppRootPath(cwd);
  const newTarballPath = path.join(myPath, `./.poly/dependencies/${filename}`);
  await moveFile(tarballPath, newTarballPath);
  return newTarballPath;
}