import { findPackage } from "@jspencev/node-util";

/**
 * Gets the filename generated by packing the project.
 * @param {String} projectDir - Project directory.
 * @returns {String} - Filename of a packed tarball.
 */
export default async function getTarballFilename(projectDir) {
  const { pack } = await findPackage(projectDir);
  const name = pack.name;
  const version = pack.version;
  const filename = `${name}-v${version}.tgz`;
  return filename;
}
