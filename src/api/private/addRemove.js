import { isRepoProject, findRepository, writeJSONToFile, scopify, yarn, addDependenciesToProject } from '../../util';
import { findPackage, isFile } from '@carbon/node-util';
import { isOneOf, sortObject } from '@carbon/util';
import _ from 'lodash';
import chalk from 'chalk';

export default async function addRemove(dependencies, type, config, cwd) {
  if (!isOneOf(type, 'add', 'remove')) {
    throw Error('Incorrect type. Must be one of "add" or "remove".');
  }

  // Pull the repo and package.json. Save a copy of the original package.json in case we need to abort.
  const {repo, repoPath} = await findRepository(cwd);
  const fp = await findPackage(cwd);
  const pack = fp.pack;
  const packPath = fp.packPath;
  const myProjectName = pack.name;
  let myProject = repo.projects[myProjectName];
  const originalPack = _.cloneDeep(pack);
  
  // verify that this package is a project of the repository
  if (!isRepoProject(myProjectName, repo)) {
    throw Error(`We could not find project "${myProjectName}" in the repository file`);
  }

  // ensure that all relevant dependency fields are present
  if (!pack.dependencies) {
    pack.dependencies = {};
  }
  if (!pack.devDependencies) {
    pack.devDependencies = {};
  }
  if (!pack.localDependencies) {
    pack.localDependencies = [];
  }
  if (!pack.localDevDependencies) {
    pack.localDevDependencies = [];
  }

  // Hoist the initial dependencies into a copy of the initial package.json state. This ensures we start with exactly what yarn last saw. 
  // Yarn sometimes tries to undo our "mistakes" so we need to ensure yarn is happy before proceeding with modification.
  // If a tarball is missing the modification is aborted.
  const initHoistedPack = _.cloneDeep(pack);
  const allInitLocalDeps = [];
  for (const projectName of pack.localDependencies) {
    const tarballPath = await getTarballPath(projectName, repo);
    const scopedName = scopify(projectName, repo);
    initHoistedPack.dependencies[scopedName] = `file:${tarballPath}`;
    allInitLocalDeps.push(scopedName);
  }
  for (const devProjectName of pack.localDevDependencies) {
    const tarballPath = await getTarballPath(devProjectName, repo);
    const scopedName = scopify(devProjectName, repo);
    initHoistedPack.devDependencies[scopedName] = `file:${tarballPath}`;
    allInitLocalDeps.push(scopedName);
  }

  // Collect the dependencies to remove and add. This includes a remove & add of every local dependency.
  let depsToRemove = [].concat(allInitLocalDeps);
  let depsToAdd = [];
  let devDepsToAdd = [];
  if (config.local) {
    // If local modification, either add or remove the specified dependencies from the package's local dependency arrays.
    for (const projectName of dependencies) {
      if (!isRepoProject(projectName, repo)) {
        throw Error(`"${projectName}" is not a project of this repository. Aborting...`);
      }

      if (type === 'add') {
        if (config.dev) {
          if (!pack.localDevDependencies.includes(projectName)) {
            pack.localDevDependencies.push(projectName);
          }
        } else {
          if (!pack.localDependencies.includes(projectName)) {
            pack.localDependencies.push(projectName);
          }
        }
      } else {
        const normPosition = pack.localDependencies.indexOf(projectName);
        if (normPosition !== -1) {
          pack.localDependencies.splice(normPosition, 1);
        }
        const devPosition = pack.localDevDependencies.indexOf(projectName);
        if (devPosition !== -1) {
          pack.localDevDependencies.splice(devPosition, 1);
        }
      }
    }
  } else {
    if (type === 'add') {
      if (config.dev) {
        devDepsToAdd = devDepsToAdd.concat(dependencies);
      } else {
        depsToAdd = depsToAdd.concat(dependencies);
      }
    } else {
      depsToRemove = depsToRemove.concat(dependencies);
    }
  }

  // Collect the final local dependencies for re-addition with yarn.
  // If a tarball is missing the modification is aborted.
  for (const projectName of pack.localDependencies) {
    const tarballPath = await getTarballPath(projectName, repo);
    const scopedName = scopify(projectName, repo);
    const modVal = `${scopedName}@file:${tarballPath}`;
    depsToAdd.push(modVal);
  }
  for (const devProjectName of pack.localDevDependencies) {
    const tarballPath = await getTarballPath(devProjectName, repo);
    const scopedName = scopify(devProjectName, repo);
    const modVal = `${scopedName}@file:${tarballPath}`;
    devDepsToAdd.push(modVal);
  }

  // Through this next section, we modify the real package.json. 
  // In case of an error, package.json is rolled back to it's initial state to prevent dependency loss.
  try {
    await writeJSONToFile(packPath, initHoistedPack);

    // run remove
    if (depsToRemove.length > 0) {
      if (cwd) {
        console.log(chalk.cyan('Running in: ') + cwd);
      }
      console.log(chalk.cyan('yarn remove ' + depsToRemove.join(' ')));
      await yarn(['remove'].concat(depsToRemove), cwd);
    }

    // run dependency add
    if (depsToAdd.length > 0) {
      if (cwd) {
        console.log(chalk.cyan('Running in: ') + cwd);
      }
      console.log(chalk.cyan('yarn add ' + depsToAdd.join(' ')));
      await yarn(['add'].concat(depsToAdd), cwd);
    }

    // run devDependency add
    if (devDepsToAdd.length > 0) {
      if (cwd) {
        console.log(chalk.cyan('Running in: ') + cwd);
      }
      console.log(chalk.cyan('yarn add --dev ' + devDepsToAdd.join(' ')));
      await yarn(['add', '--dev'].concat(devDepsToAdd), cwd);
    }

    // pull the new package generated by yarn without local projects
    const np = await findPackage(cwd);
    const newPack = np.pack;
    const newDeps = {};
    const newDevDeps = {};
    for (const dep in newPack.dependencies) {
      if (!isRepoProject(dep, repo)) {
        newDeps[dep] = newPack.dependencies[dep];
      }
    }
    for (const devDep in newPack.devDependencies) {
      if (!isRepoProject(devDep, repo)) {
        newDevDeps[devDep] = newPack.devDependencies[devDep];
      }
    }
    pack.dependencies = newDeps;
    pack.devDependencies = newDevDeps;

    // Sort all dependencies and write the final package.
    pack.dependencies = sortObject(pack.dependencies);
    pack.devDependencies = sortObject(pack.devDependencies);
    pack.localDependencies = pack.localDependencies.sort();
    pack.localDevDependencies = pack.localDevDependencies.sort();
    await writeJSONToFile(packPath, pack);

    // Update the repository to reflect changes.
    myProject = addDependenciesToProject(myProject, pack);
    repo.projects[myProjectName] = myProject;
    await writeJSONToFile(repoPath, repo);
  } catch (e) {
    await writeJSONToFile(packPath, originalPack);
    throw e;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Gets the tarball path for a project and checks to make sure it exists.
 * An error is thrown and modification aborted if the tarball is missing.
 * @param {String} projectName - Project to get the tarball path for.
 * @param {*} repo - The repository object.
 * @returns {String} - Absolute path to the tarball for the submitted project.
 */
async function getTarballPath(projectName, repo) {
  const project = repo.projects[projectName];
  if (!project) {
    throw Error(`We could not find project "${projectName}" in the repository file`);
  }

  const tarballPath = project.tarball;
  const err = `Project "${projectName}" must be built with polyman. Run "poly build" in the project directory.`;
  if (!tarballPath) {
    throw Error(err);
  } else if (!(await isFile(tarballPath))) {
    throw Error(err);
  }

  return tarballPath;   
}