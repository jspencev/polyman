import findPackage from './findPackage';
const path = require('path');

/**
 * Gets the root path of the app by looking for package.json up the directory tree from the current working directory.
 * @param {String} cwd - Current working directory.
 * @returns {String} - Absolute path to the app root directory.
 */
export default async function getAppRootPath(cwd) {
  const {packPath} = await findPackage(cwd);
  const appRootPath = path.parse(packPath).dir;
  return appRootPath;
}