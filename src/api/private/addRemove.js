const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { findRepository, getConnectedProjects, generatePolymanDeps, isRepoProject, getLocalTarballPath, descopify, writeJSONToFile, yarn } from '../../util';
import { findPackage, getAppRootPath, isFile, writeFileIfNotExist } from '@carbon/node-util';
import { isOneOf, sortObject } from '@carbon/util';
const _ = require('lodash');
const path = require('path');
const thenify = require('thenify');
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

    if (config.local) {  
      // update production pack and repo with changes. tarballs are coppied later.
      const dependenciesDir = path.join(appRootPath, '.poly', 'dependencies');
      const devDependenciesDir = path.join(appRootPath, '.poly', 'devDependencies');
      let depDir;
      if (config.dev) {
        depDir = devDependenciesDir;
      } else {
        depDir = dependenciesDir;
      }
  
      if (type === 'add') {
        for (const dep of dependencies) {
          const project = repo.projects[dep];
          let localTarballPath = path.join(depDir, path.parse(project.tarball).base);
          localTarballPath = path.relative(appRootPath, localTarballPath);
          const scopedName = `@${repo.name}/${dep}`;
          if (config.dev) {
            prodPack.devDependencies[scopedName] = 'file:' + localTarballPath;
          } else {
            prodPack.dependencies[scopedName] = 'file:' + localTarballPath;
          }
        }
      } else {
        for (const dep in prodPack.dependencies) {
          if (isRepoProject(dep, repo) && dependencies.includes(descopify(dep))) {
            delete prodPack.dependencies[dep];
          }
        }
        for (const devDep in prodPack.devDependencies) {
          if (isRepoProject(devDep, repo) && dependencies.includes(descopify(devDep))) {
            delete prodPack.devDependencies[devDep];
          }
        }
      }
  
      repo.projects[myProjectName] = await generatePolymanDeps(repo, repo.projects[myProjectName], prodPack);
    }
  
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
    const dependenciesDir = path.join(appRootPath, '.poly', 'dependencies');
    const devDependenciesDir = path.join(appRootPath, '.poly', 'devDependencies');
    await rimraf(dependenciesDir);
    await rimraf(devDependenciesDir)
    const tmpPack = (await findPackage(cwd)).pack;
    if (!prodPack.dependencies) {
      prodPack.dependencies = {};
    }
    if (!prodPack.devDependencies) {
      prodPack.devDependencies = {};
    }
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
    await rollback(originalPack, packPath);
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
  const err = `Project "${projectName}" must be build with polyman. Run "poly build" in the project directory.`;
  projectName = descopify(projectName);
  if (!repo.projects[projectName].tarball) {
    throw Error(err);
  }
  const prodTarballExists = await isFile(repo.projects[projectName].tarball);
  if (!prodTarballExists) {
    throw Error(err);
  }

  const localTarballExists = await isFile(getLocalTarballPath(projectName, repo, repoPath));
  if (!localTarballExists) {
    throw Error(err);
  }
}

async function copyFile(oldLocation, newLocation) {
  await writeFileIfNotExist(newLocation, '');
  await fs.copyFile(oldLocation, newLocation);
}

async function rollback(pack, packPath) {
  await writeJSONToFile(packPath, pack);
}