import path from "path";

const DEFAULT = "./.poly/tmp";

/**
 * Gets the temporary directory for a given project directory
 * @param {String} projectDir - Project directory
 */
export default function getTmpDir(projectDir) {
  const tmpDir = path.resolve(projectDir, DEFAULT);
  return tmpDir;
}
