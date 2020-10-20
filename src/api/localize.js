import { findRepository, findPackage, areAllTruthy, isOneTruthy } from '../util';
import local from './local';

/**
 * Localize projects that are dependencies of the project on the current working directory.
 * If no dependencies are passed, all dependent projects will be localized.
 * Projects will not be localized if repository.poly does not have a local_path recorded for the project.
 * @param {Array<String>} dependencies - Dependencies to localize. If empty, will localize all.
 * @param {*} config - Config object.
 * @param {String} cwd - Current working directory.
 */
export default async function localize(dependencies = [], config, cwd) {
  const {repo} = await findRepository(cwd);
  const {pack} = await findPackage(cwd);

  const toLocalize = generateToLocalize(repo, Object.keys(pack.dependencies), dependencies);
  const toLocalizeDev = generateToLocalize(repo, Object.keys(pack.devDependencies), dependencies);
  const toRemove = toLocalize.concat(toLocalizeDev);
  if (toRemove.length > 0) {
    await local(toRemove, 'remove', cwd);
  }
  if (toLocalize.length > 0) {
    await local(toLocalize, 'add', {dev: false}, cwd);
  }
  if (toLocalizeDev.length > 0) {
    await local(toLocalizeDev, 'add', {dev: true}, cwd);
  }
}

/**
 * Generate array of projects to localize.
 * @param {*} repo - Repository object
 * @param {Array<String>} packDeps - Package dependencies
 * @param {Array<String>} dependencies - Dependencies to localize. If empty, will localize all.
 * @returns {Array<String>} - List of projects to localize.
 */
function generateToLocalize(repo, packDeps, dependencies) {
  const toLocalize = [];
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    const scopedName = `@${repo.name}/${projectName}`;
    if (
      areAllTruthy(
        packDeps.includes(scopedName), 
        project.local_path, 
        isOneTruthy(dependencies.length === 0, dependencies.includes(projectName))
      )
    ) {
      toLocalize.push(projectName);
    }
  }
  return toLocalize;
}