import { getBuiltTarballDir, getTarballFilename } from "%/util";
import path from "path";

/**
 * Gets the absolute built tarball path for the project in the directory submitted.
 * @param {String} projectDir - Project directory
 * @returns {String} - Absolute built tarball path.
 */
export default async function getBuiltTarballPath(projectDir) {
  const builtTarballDir = await getBuiltTarballDir(projectDir);
  const tarballFilename = await getTarballFilename(projectDir);
  const builtTarballPath = path.join(builtTarballDir, tarballFilename);
  return builtTarballPath;
}
