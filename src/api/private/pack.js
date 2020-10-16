import { findPackage, yarn, moveFile } from '../../util';
const path = require('path');

export default async function pack(depProject, depName, cwd) {
  await yarn(`pack`, depProject.local_path);
  const depPack = (await findPackage(depProject.local_path)).pack;
  const depVersion = depPack.version;
  const filename = `${depName}-v${depVersion}.tgz`
  const tarballPath = path.join(depProject.local_path, filename);
  let myPath = (await findPackage(cwd)).packPath;
  myPath = path.parse(myPath).dir;
  const newTarballPath = path.join(myPath, `./.poly/dependencies/${filename}`);
  await moveFile(tarballPath, newTarballPath);
  return newTarballPath;
}