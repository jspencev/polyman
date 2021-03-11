import { findRepository, writeJSONToFile, scopify, yarn, addDependenciesToProject, isSameRepo } from '%/util';
import { findPackage, isFile } from '@jspencev/node-util';
import { isOneOf, sortObject, fallback } from '@jspencev/util';
import _ from 'lodash';
import chalk from 'chalk';
import path from 'path';
import md5 from 'md5';
import thenifyAll from 'thenify-all';
import _fs from 'fs';
const fs = thenifyAll(_fs);
import _glob from 'glob';
const glob = thenifyAll(_glob);

export default async function addRemove(dependencies, type, config, cwd) {
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
      throw Error(`We could not find project "${myProjectName}" in the repository file`);
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

  // get the list of initial local dependencies
  let initLocalDeps;
  if (config.production) {
    // only grab the local dependencies
    initLocalDeps = myPack.localDependencies;
  } else {
    // grab both local dependencies and local dev dependencies
    initLocalDeps = myPack.localDependencies.concat(myPack.localDevDependencies);
  }

  // get the tarball paths for each local dependency and figure out which need to be relinked
  // if a project's tarball does not exist the whole command is aborted
  const localsToRelink = {};
  for (const projectName of initLocalDeps) {
    let tarballPath;
    let shouldRelink = true;
    if (sameRepo) {
      const project = repo.projects[projectName];
      tarballPath = await getTarballPath(project);

      if (!config.force && project.local_path) {
        const hash = md5(await fs.readFile(tarballPath));
        if (myProject.local_dependencies[projectName] === hash) {
          shouldRelink = false;
        }
      }
    } else {
      const tarballDir = path.join(myProjectDir, '.poly/dependencies');
      const globPattern = path.join(tarballDir, `${projectName}*`);
      const results = await glob(globPattern);
      if (results.length === 0) {
        throw Error(`Tarball for "${projectName}" couldn't be found in ${tarballDir}`);
      }
      tarballPath = results[0];

      if (!config.install) {
        shouldRelink = false;
      }
    }
    
    // add the project's dependency value to the hoisted package.json
    const scopedName = scopify(projectName, repoName);
    const localDepVal = makeLocalDepVal(tarballPath);
    initHoistedPack.dependencies[scopedName] = localDepVal;

    if (shouldRelink) {
      const localDepAddCmd = makeLocalDepAddCmd(scopedName, localDepVal);
      localsToRelink[scopedName] = localDepAddCmd;
    }
  }

  // Generate a list of dependencies to remove and add
  const depsToRemove = Object.keys(localsToRelink);
  const depsToAdd = Object.values(localsToRelink);
  const devDepsToAdd = [];
  for (const dep of dependencies) {
    if (config.local) {
      if (sameRepo) {
        const project = repo.projects[dep];
        if (project) {
          const scopedName = scopify(dep, repoName);
          const tarballPath = await getTarballPath(project);
          const localDepVal = makeLocalDepVal(tarballPath);
          const localDepAddCmd = makeLocalDepAddCmd(scopedName, localDepVal);
          if (type === 'add') {
            depsToAdd.push(localDepAddCmd);
            if (config.dev) {
              if (!myPack.localDevDependencies.includes(dep)) {
                myPack.localDevDependencies.push(dep);
              }
            } else {
              if (!myPack.localDependencies.includes(dep)) {
                myPack.localDependencies.push(dep);
              }
            }
          } else {
            if (!depsToRemove.includes(scopedName)) {
              depsToRemove.push(scopedName);
            }
            _.pull(depsToAdd, localDepAddCmd);
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
      myProject = addDependenciesToProject(myProject, myPack, repo);
      repo.projects[myProjectName] = myProject;
      await writeJSONToFile(repoPath, repo);
    }

    return {pack: myPack, repo};
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