import { findRepository, findPackage, getAppRootPath } from '../util';
import local from './local';
import add from './add';
import pack from './private/pack';
const path = require('path');

export default async function delocalize(dependencies = [], config, cwd) {
  const {repo} = await findRepository(cwd);
  const myPackage = await findPackage(cwd);
  const myName = myPackage.pack.name;
  const myProject = repo.projects[myName];

  const toDelocalize = generateToDelocalize(myProject.local_dependencies, dependencies);
  const toDelocalizeDev = generateToDelocalize(myProject.local_dev_dependencies, dependencies);
  const toRemove = toDelocalize.concat(toDelocalizeDev);
  if (toRemove > 0) {
    await local(toRemove, 'remove', config, cwd);
  }

  const toAdd = await generateToAdd(repo, toDelocalize, cwd);
  if (toAdd.length > 0) {
    await add(toAdd, {dev: false}, cwd);
  }
  const toAddDev = await generateToAdd(repo, toDelocalizeDev, cwd);
  if (toAddDev.length > 0) {
    await add(toAddDev, {dev: true}, cwd);
  }
}

/**
 * Generate list of local project objects to delocalize.
 * @param {*} repo - Repository object
 * @param {Array<String>} projectDeps - Local dependencies from the active project.
 * @param {Array<String>} dependencies - Subset of local dependencies to delocalize. If an empty array is passed, all local dependencies will be returned.
 * @returns {Array<String>} - Local dependencies to delocalize.
 */
function generateToDelocalize(projectDeps, dependencies) {
  const toDelocalize = [];
  for (const projectName in projectDeps) {
    if (dependencies.length === 0 || dependencies.includes(projectName)) {
      toDelocalize.push(projectName);
    }
  }
  return toDelocalize;
}

/**
 * Generates list of dependencies to add. Dependencies are aliased to @<repo name>/<project>.
 * @param {*} repo - Repository object
 * @param {Array<String>} toDelocalize - Projects to delocalize.
 * @param {String} cwd - Current working directory.
 * @returns {Array<String>} - List of dependencies to pass to yarn.
 */
async function generateToAdd(repo, toDelocalize, cwd) {
  const toAdd = [];
  for (const projectName of toDelocalize) {
    const project = repo.projects[projectName];
    const scopedName = `@${repo.name}/${projectName}`;
    if (project.npm) {
      toAdd.push(`${scopedName}@npm:${project.npm}`);
    } else if (project.git_repository) {
      toAdd.push(`${scopedName}@npm:${project.git_repository}`);
    } else {
      const appRootPath = await getAppRootPath(cwd);
      let packedTarballPath = await pack(projectName, project, cwd);
      packedTarballPath = path.relative(appRootPath, packedTarballPath);
      toAdd.push(`${scopedName}@file:${packedTarballPath}`);
    }
  }
  return toAdd;
}