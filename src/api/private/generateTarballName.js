import { findPackage } from '@jspencev/node-util';

export default async function generateTarballName(depLocalPath) {
  const depPack = (await findPackage(depLocalPath)).pack;
  const depName = depPack.name;
  const depVersion = depPack.version;
  const filename = `${depName}-v${depVersion}.tgz`;
  return filename;
}