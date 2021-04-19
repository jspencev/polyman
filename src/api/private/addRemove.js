import { findRepository, scopify, yarn, isSameRepo, copyDirectory, getTmpDir, getDependenciesDir, findInMyDependencies, hashFile } from '%/util';
import { findPackage, isFile, randomString, moveFile, writeJSONToFile } from '@jspencev/node-util';
import { isOneOf, sortObject, fallback, pushUnique } from '@jspencev/util';
import _ from 'lodash';
import chalk from 'chalk';
import path from 'path';
import thenifyAll from 'thenify-all';
import thenify from 'thenify';
import _fs from 'fs';
const fs = thenifyAll(_fs);
import _rimraf from 'rimraf';
const rimraf = thenify(_rimraf);

export default async function addRemove(dependencies, type, config = {}, cwd) {
  if (!isOneOf(type, 'add', 'remove')) {
    throw Error('Incorrect type. Must be one of "add" or "remove".');
  }

  // pull the package and make a copy in case of abort
  const {pack: myPack, packPath: myPackPath} = await findPackage(cwd);
  const originalPack = _.cloneDeep(myPack);

  // determine whether the project is in the polyrepo or not
  const myProjectName = myPack.name;
  const myProjectDir = path.parse(myPackPath).dir;
  const {sameRepo, repoName} = await isSameRepo(myProjectDir);

  let repo;
  let repoPath;
  let myProject;
  if (sameRepo) {
    // get the repository and the project object for the project we're executing for
    ({repo, repoPath} = await findRepository(myProjectDir));
    myProject = repo.projects[myProjectName];

    // verify that this project is a part of the repository
    if (!myProject) {
      throw Error(`Project "${myProjectName}" is not part of this repository.`);
    }
  }

  // ensure that all relevant dependency fields are present in package.json
  myPack.dependencies = fallback(myPack.dependencies, {});
  myPack.devDependencies = fallback(myPack.devDependencies, {});
  myPack.localDependencies = fallback(myPack.localDependencies, []);
  myPack.localDevDependencies = fallback(myPack.localDevDependencies, []);

  // hoist the initial dependencies into a copy of the initial package.json state
  // This ensures we start with what yarn last saw. Yarn sometimes tries to undo our "mistakes" so we need to make sure yarn is happy before proceeding with modification.
  const initHoistedPack = _.cloneDeep(myPack);

  // generate a list of dependencies to add/remove
  const depsToRemove = [];
  const depsToAdd = [];
  const devDepsToAdd = [];
  for (const dep of dependencies) {
    if (config.local) {
      if (sameRepo) {
        const project = repo.projects[dep];
        if (project) {
          if (type === 'add') {
            // Add to the package. The add command will be added later.
            if (config.dev) {
              pushUnique(myPack.localDevDependencies, dep);
              myProject.local_dev_dependencies[dep] = 'init';
            } else {
              pushUnique(myPack.localDependencies, dep);
              myProject.local_dependencies[dep] = 'init';
            }
          } else {
            // Add to the dependencies to remove and strip from the package so it won't be tested for relink.
            const scopedName = scopify(dep, repoName);
            depsToRemove.push(scopedName);
            initHoistedPack.dependencies[scopedName] = 'removing...';
            _.pull(myPack.localDependencies, dep);
            _.pull(myPack.localDevDependencies, dep);
          }
        } else {
          throw Error(`Project "${dep}" is not part of this repository.`);
        }
      } else {
        throw Error('Cannot modify local dependency when project not in the repository folder.');
      }
    } else {
      if (type === 'add') {
        if (config.dev) {
          devDepsToAdd.push(dep);
        } else {
          depsToAdd.push(dep);
        }
      } else {
        depsToRemove.push(dep);
      }
    }
  }

  // get the list of local dependencies that could be relinked
  let possibleLocalDeps
  if (config.production) {
    possibleLocalDeps = myPack.localDependencies;
  } else {
    possibleLocalDeps = myPack.localDependencies.concat(myPack.localDevDependencies);
  }

  const myTmpDir = getTmpDir(myProjectDir);
  const tmpTarballsDir = path.join(myTmpDir, randomString(8));
  const myDepDir = getDependenciesDir(myProjectDir);

  // figure out which local dependencies need to be relinked
  for (const projectName of possibleLocalDeps) {
    let should = false;
    let finalTarballPath;
    if (sameRepo) {
      // find the project's tarball original location
      // will abort if the tarball does not exist
      const project = repo.projects[projectName];
      const originalTarballPath = await getTarballPath(project);

      // copy the tarballs into a temporary directory
      const filename = path.parse(originalTarballPath).base;
      await moveFile(originalTarballPath, path.join(tmpTarballsDir, filename), true);
      finalTarballPath = path.join(myDepDir, filename);

      if (config.force) {
        should = true;
      } else {
        const hash = await hashFile(originalTarballPath);
        const localDep = fallback(myProject.local_dependencies[projectName], myProject.local_dev_dependencies[projectName]);
        if (hash !== localDep) {
          should = true;
        }
        if (myProject.local_dependencies[projectName]) {
          myProject.local_dependencies[projectName] = hash;
        } else if (myProject.local_dev_dependencies[projectName]) {
          myProject.local_dev_dependencies[projectName] = hash;
        }
      }
    } else {
      if (config.install) {
        finalTarballPath = await findInMyDependencies(myProjectDir, projectName);
        should = true;
      }
    }

    const scopedName = scopify(projectName, repoName);
    const localDepVal = makeLocalDepVal(finalTarballPath);
    initHoistedPack.dependencies[scopedName] = localDepVal;

    if (should) {
      const addCmd = makeLocalDepAddCmd(scopedName, localDepVal);
      depsToRemove.push(scopedName);
      depsToAdd.push(addCmd);
    }
  }

  if (sameRepo) {
    // copy the temporary tarballs into the main directory
    await rimraf(myDepDir);
    await copyDirectory(tmpTarballsDir, myDepDir);
    await rimraf(myTmpDir);
  }

  // Through this next section, we modify the real package.json. 
  // In case of an error, package.json is rolled back to it's initial state.
  try {
    // write hoised package
    await writeJSONToFile(myPackPath, initHoistedPack);

    // remove dependencies that need to be removed
    if (depsToRemove.length > 0) {
      if (cwd) {
        console.log(chalk.cyan('Running in: ') + myProjectDir);
      }
      console.log(chalk.cyan('yarn remove ' + depsToRemove.join(' ')));
      await yarn(['remove'].concat(depsToRemove), myProjectDir);
    }

    // add dependencies that need to be added
    if (depsToAdd.length > 0) {
      if (cwd) {
        console.log(chalk.cyan('Running in: ') + myProjectDir);
      }
      console.log(chalk.cyan('yarn add ' + depsToAdd.join(' ')));
      await yarn(['add'].concat(depsToAdd), myProjectDir);
    }

    // run devDependency add
    if (devDepsToAdd.length > 0) {
      if (cwd) {
        console.log(chalk.cyan('Running in: ') + myProjectDir);
      }
      console.log(chalk.cyan('yarn add --dev ' + devDepsToAdd.join(' ')));
      await yarn(['add', '--dev'].concat(devDepsToAdd), myProjectDir);
    }

    // pull the new package generated by yarn
    const {pack: newPack} = await findPackage(myProjectDir);

    // get the final list of local dependencies
    let finalLocalDeps;
    if (config.production) {
      finalLocalDeps = myPack.localDependencies;
    } else {
      finalLocalDeps = myPack.localDependencies.concat(myPack.localDevDependencies);
    }
    
    // remove local projects from dependencies
    for (const projectName of finalLocalDeps) {
      const scopedName = scopify(projectName, repoName);
      delete newPack.dependencies[scopedName];
    }

    myPack.dependencies = newPack.dependencies;
    myPack.devDependencies = newPack.devDependencies;

    // sort all dependencies and write the final package
    myPack.dependencies = sortObject(myPack.dependencies);
    myPack.devDependencies = sortObject(myPack.devDependencies);
    myPack.localDependencies = myPack.localDependencies.sort();
    myPack.localDevDependencies = myPack.localDevDependencies.sort();
    await writeJSONToFile(myPackPath, myPack);

    // update repository to reflect changes
    if (sameRepo) {
      myProject.dependencies = myPack.dependencies;
      myProject.dev_dependencies = myPack.devDependencies;
      myProject.local_dependencies = _.pick(myProject.local_dependencies, myPack.localDependencies);
      myProject.local_dev_dependencies = _.pick(myProject.local_dev_dependencies, myPack.localDevDependencies);
      myProject.build_dependencies = fallback(myProject.build_dependencies, []);
      repo.projects[myProjectName] = myProject;
      await writeJSONToFile(repoPath, repo);
    }

    const didRelink = !(depsToRemove.length === 0 && depsToAdd.length === 0 && devDepsToAdd.length === 0);

    return {pack: myPack, repo, didRelink};
  } catch (e) {
    await writeJSONToFile(myPackPath, originalPack);
    throw e;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Gets the tarball path for a project and checks to make sure it exists.
 * @param {*} project - The project object.
 * @returns {String} - Absolute path to the project's tarball file.
 */
async function getTarballPath(project) {
  if (!project) {
    throw Error(`We could not find project "${project.name}" in the repository file.`);
  }

  const tarballPath = project.tarball;
  const err = `Project "${project.name}" must be built with polyman. Run "poly build" in the project directory.`;
  if (!tarballPath) {
    throw Error(err);
  } else if (!(await isFile(tarballPath))) {
    throw Error(err);
  }

  return tarballPath; 
}

/**
 * Makes tarball path into dependency value for package.json
 * @param {String} tarballPath - Path to the tarball to be installed.
 * @returns {String} - Dependency value for package.json
 */
function makeLocalDepVal(tarballPath) {
  const val = `file:${tarballPath}`;
  return val;
}

/**
 * Makes the yarn add argument for the local dependency
 * @param {String} scopedName - Scoped dependency name.
 * @param {String} localDepVal - Local dependency value for package.json.
 * @returns {String} - Yarn add command.
 */
function makeLocalDepAddCmd(scopedName, localDepVal) {
  const localDepAddCmd = `${scopedName}@${localDepVal}`;
  return localDepAddCmd;
}