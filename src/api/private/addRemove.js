const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { findRepository, getConnectedProjects, generatePolymanDeps, isRepoProject, descopify, writeJSONToFile, yarn, scopify } from '../../util';
import { findPackage, getAppRootPath, isFile, writeFileIfNotExist } from '@carbon/node-util';
import { isOneOf, sortObject } from '@carbon/util';
const _ = require('lodash');
const path = require('path');
import thenify from 'thenify';
const rimraf = thenify(require('rimraf'));

export default async function addRemove(dependencies, type, config, cwd) {
  if (!isOneOf(type, 'add', 'remove')) {
    throw Error('Incorrect type. Must be one of "add" or "remove".');
  }

  const appRootPath = await getAppRootPath(cwd);

  // pull the repo and the production package
  const {repo, repoPath} = await findRepository(cwd);
  const fp = await findPackage(cwd);
  const prodPack = fp.pack;
  const packPath = fp.packPath;
  const originalPack = _.cloneDeep(prodPack);

  // verify that this package is a project of the repository
  const myProjectName = prodPack.name;
  if (!isRepoProject(myProjectName, repo)) {
    throw Error(`We could not find project "${myProjectName}" in the repository file`);
  }

  try {
    // hoist premodified local dependencies
    const hoisted = hoistLocalDependencies(prodPack, repo, repoPath);
    const premodLocalPack = hoisted.localPack;
    const premodLocalDeps = hoisted.localDependencies;
    for (const d in premodLocalDeps) {
      await checkTarballs(d, repo, repoPath);
    }
    const toRemove = Object.keys(premodLocalDeps);

    const dependenciesDir = path.join(appRootPath, '.poly', 'dependencies');
    const devDependenciesDir = path.join(appRootPath, '.poly', 'devDependencies');

    if (config.local) {  
      // update production pack and repo with changes. tarballs are coppied later.
      for (const projectName of dependencies) {
        if (isRepoProject(projectName, repo)) {
          const scopedName = scopify(projectName, repo);
          if (type === 'add') {
            // tarball filenames are added in the next step
            if (config.dev) {
              prodPack.devDependencies[scopedName] = true;
            } else {
              prodPack.dependencies[scopedName] = true;
            }
          } else {
            delete prodPack.dependencies[scopedName];
            delete prodPack.devDependencies[scopedName];
          }
        } else {
          throw Error(`"${projectName}" is not a project of this repository. Aborting...`);
        }
      }
    }

    // ensure that the most up-to-date tarballs are being used.
    for (const dep in prodPack.dependencies) {
      if (isRepoProject(dep, repo)) {
        const projectName = descopify(dep);
        const project = repo.projects[projectName];
        let localTarballPath = path.join(dependenciesDir, path.parse(project.tarball).base);
        localTarballPath = path.relative(appRootPath, localTarballPath);
        prodPack.dependencies[dep] = `file:./${localTarballPath}`;
      }
    }
    for (const devDep in prodPack.devDependencies) {
      if (isRepoProject(devDep, repo)) {
        const projectName = descopify(devDep);
        const project = repo.projects[projectName];
        let localTarballPath = path.join(devDependenciesDir, path.parse(project.tarball).base);
        localTarballPath = path.relative(appRootPath, localTarballPath);
        prodPack.devDependencies[devDep] = `file:./${localTarballPath}`;
      }
    }

    repo.projects[myProjectName] = await generatePolymanDeps(repo, repo.projects[myProjectName], prodPack);
  
    // hoist local dependency tree into package dependencies. This always happens because we do not want yarn to try to re-install "missing" packages.
    const postmodHoist = hoistLocalDependencies(prodPack, repo, repoPath);
    const postmodLocalDeps = postmodHoist.localDependencies;

    // write the premodified local package.json
    await writeJSONToFile(packPath, premodLocalPack);
  
    // either add all local dependencies or run the yarn command
    if (config.local) {
      // hoist postmodified local dependencies, but do not write package.json yet.
      const toAdd = [];
      for (const localDep in postmodLocalDeps) {
        const tarballPath = postmodLocalDeps[localDep];
        toAdd.push(`${localDep}@${tarballPath}`);
      }
      for (const d in postmodLocalDeps) {
        await checkTarballs(d, repo, repoPath);
      }
  
      // remove all local dependencies
      if (toRemove.length !== 0) {
        toRemove.unshift('remove');
        await yarn(toRemove, cwd);
      }

      if (toAdd.length !== 0) {
        toAdd.unshift('add');
        await yarn(toAdd, cwd);
      }
    } else {
      // run yarn
      if (dependencies.length !== 0) {
        let yarnCmd;
        if (type === 'add') {
          yarnCmd = ['add'];
          if (config.dev) {
            yarnCmd.push('--dev');
          } else if (config.peer) {
            yarnCmd.push('--peer');
          } else if (config.optional) {
            yarnCmd.push('--optional');
          }
          if (config.exact) {
            yarnCmd.push('--exact');
          } else if (config.tilde) {
            yarnCmd.push('--tilde');
          }
        } else if (type === 'remove') {
          yarnCmd = ['remove'];
        }
    
        yarnCmd = yarnCmd.concat(...dependencies);
        await yarn(yarnCmd, cwd);
      }
    }
  
    // pull the new package.json, update all non-repo dependencies in the final package.json, and pull new production local dependency tarballs
    await rimraf(dependenciesDir);
    await rimraf(devDependenciesDir)
    const tmpPack = (await findPackage(cwd)).pack;
    if (!prodPack.dependencies) {
      prodPack.dependencies = {};
    }
    if (!prodPack.devDependencies) {
      prodPack.devDependencies = {};
    }

    if (type === 'add') {
      for (const dep in tmpPack.dependencies) {
        if (!isRepoProject(dep, repo)) {
          prodPack.dependencies[dep] = tmpPack.dependencies[dep];
        }
      }
      for (const devDep in tmpPack.devDependencies) {
        if (!isRepoProject(devDep, repo)) {
          prodPack.devDependencies[devDep] = tmpPack.devDependencies[devDep];
        }
      }
    } else {
      for (const dep in prodPack.dependencies) {
        if (!isRepoProject(dep, repo) && !tmpPack.dependencies[dep]) {
          delete prodPack.dependencies[dep];
        }
      }
      for (const devDep in prodPack.devDependencies) {
        if (!isRepoProject(devDep, repo) && !tmpPack.devDependencies[devDep]) {
          delete prodPack.devDependencies[devDep];
        }
      }
    }

    prodPack.dependencies = sortObject(prodPack.dependencies);
    prodPack.devDependencies = sortObject(prodPack.devDependencies);

    for (const dep in prodPack.dependencies) {
      if (isRepoProject(dep, repo)) {
        const projectName = descopify(dep);
        const tarballPath = repo.projects[projectName].tarball;
        const filename = path.parse(tarballPath).base;
        const newHome = path.resolve(dependenciesDir, filename);
        await copyFile(tarballPath, newHome);
      }
    }
    for (const devDep in prodPack.devDependencies) {
      if (isRepoProject(devDep, repo)) {
        const projectName = descopify(devDep);
        const tarballPath = repo.projects[projectName].tarball;
        const filename = path.parse(tarballPath).base;
        const newHome = path.resolve(devDependenciesDir, filename);
        await copyFile(tarballPath, newHome);
      }
    }

    // write final package.json and final repository.poly
    await writeJSONToFile(packPath, prodPack);
    repo.projects[myProjectName] = await generatePolymanDeps(repo, repo.projects[myProjectName]);
    await writeJSONToFile(repoPath, repo);
  } catch (e) {
    await writeJSONToFile(packPath, originalPack);
    throw e;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////

function hoistLocalDependencies(pack, repo, repoPath) {
  const localPack = _.cloneDeep(pack);
  const connectedProjects = getConnectedProjects(pack.name, repo, true);
  const repoDir = path.parse(repoPath).dir;
  const repoTarballDir = path.resolve(repoDir, '.poly', 'build');
  const localDependencies = {};
  for (const projectName of connectedProjects) {
    const tarballFilename = path.parse(repo.projects[projectName].tarball).base;
    const tarballPath = path.resolve(repoTarballDir, tarballFilename);
    const scopedName = `@${repo.name}/${projectName}`;
    const val = `file:${tarballPath}`;
    localPack.dependencies[scopedName] = val;
    localDependencies[scopedName] = val;
  }
  for (const devDep in localPack.devDependencies) {
    if (isRepoProject(devDep, repo)) {
      delete localPack.devDependencies[devDep];
    }
  }
  return {localPack, localDependencies};
}

async function checkTarballs(projectName, repo, repoPath) {
  const err = `Project "${projectName}" must be built with polyman. Run "poly build" in the project directory.`;
  projectName = descopify(projectName);
  if (!repo.projects[projectName].tarball) {
    throw Error(err);
  }
  const prodTarballExists = await isFile(repo.projects[projectName].tarball);
  if (!prodTarballExists) {
    throw Error(err);
  }

  const prodTarball = repo.projects[projectName].tarball;
  const filename = path.parse(prodTarball).base;
  const repoDir = path.parse(repoPath).dir;
  const localTarballPath = path.join(repoDir, '.poly', 'build', filename);
  const localTarballExists = await isFile(localTarballPath);
  if (!localTarballExists) {
    throw Error(err);
  }
}

async function copyFile(oldLocation, newLocation) {
  await writeFileIfNotExist(newLocation, '');
  await fs.copyFile(oldLocation, newLocation);
}