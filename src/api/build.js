import { yarn, hashDirectory, findRepository, writeJSONToFile, scopify } from '../util';
import { findPackage, getAppRootPath, writeFileIfNotExist, randomString, moveFile, isFile } from '@carbon/node-util';
import { sortObject, isOneTruthy } from '@carbon/util';
import pack from './private/pack';
import _ from 'lodash';
const path = require('path');
import semver from 'semver';
import * as babel from '@babel/core';
import thenify from 'thenify';
const rimraf = thenify(require('rimraf'));
const glob = thenify(require('glob'));
import thenifyAll from 'thenify-all';
const fs = thenifyAll(require('fs'));
import ignore from 'ignore';

const LOCALS_DIR = '.poly_lib';

export default async function build(config, cwd) {
  const appRootPath = await getAppRootPath(cwd);
  const {repo, repoPath} = await findRepository(cwd);
  const repoDir = path.parse(repoPath).dir;

  // build the project where it is
  await yarn('build', appRootPath);

  // get the package from the local repository
  const mp = await findPackage(cwd);
  const myPack = mp.pack;
  const myProjectName = myPack.name;
  let myProject = repo.projects[myProjectName];
  
  if (!config.force && false) { // for now, builds always run
    const hash = await doHash(myProject);
    if (myProject.hash === hash) {
      return false;
    }
  }

  // set up the temporary build driectory
  const tmpPackDir = path.join(repoDir, '.poly', 'tmp', randomString(8));
  const initDir = path.join(tmpPackDir, 'tmp');
  await writeFileIfNotExist(path.join(initDir), 'foo.txt');
  await rimraf(path.join(initDir));

  // get the npmignore (fallback to gitignore) for the project and copy all unignored files to the tmp build directory
  const npmignore = await getNpmignore(appRootPath);
  await copyDirectory(appRootPath, tmpPackDir, async function(filepath) {
    filepath = path.relative(appRootPath, filepath);
    const shouldCopy = !isOneTruthy(
      npmignore.ignores(filepath),
      filepath.includes('.git')
    );
    return shouldCopy;
  });

  // get the package.json from the temporary directory
  const tp = await findPackage(tmpPackDir);
  const myTmpPack = tp.pack;
  const myTmpPackPath = tp.packPath;

  // get all versions of all dependencies down the tree
  const depVersions = await getDepVersions(myTmpPack, repo, appRootPath);
  const localDeps = Object.keys(depVersions.__locals);
  delete depVersions.__locals;

  // hoist all non-local dependencies into the tmp package
  for (const dep in depVersions) {
    const versions = depVersions[dep];
    if (versions.length !== 1) {
      throw Error(`There is a dependency version mismatch for dependency "${dep}". Your local dependenices require ${versions}. Aborting...`);
    }
    myTmpPack.dependencies[dep] = versions[0];
  }
  myTmpPack.dependencies = sortObject(myTmpPack.dependencies);

  delete myTmpPack.localDependencies;
  delete myTmpPack.localDevDependencies;

  // pull the contents of each local dependency into the build directory
  const localDirs = {};
  localDirs[scopify(myProjectName, repo)] = path.resolve(tmpPackDir, myTmpPack.main);
  for (const localDep of localDeps) {
    const localProject = repo.projects[localDep];
    const localPath = localProject.local_path;
    const lp = await findPackage(localPath);
    const localPack = lp.pack;
    const scope = `@${repo.name}`;
    if (localPack.bin) {
      for (const binCmd in localPack.bin) {
        let binPath = localPack.bin[binCmd];
        binPath = path.join(LOCALS_DIR, scope, localDep, binPath);
        if (!myTmpPack.bin) {
          myTmpPack.bin = {};
        }
        if (!myTmpPack.bin[binCmd]) {
          myTmpPack.bin[binCmd] = binPath;
        }
      }
    }
    const libDir = path.resolve(tmpPackDir, LOCALS_DIR, scope, localDep);
    localDirs[scopify(localDep, repo)] = path.resolve(libDir, localPack.main);

    const npmignore = await getNpmignore(localPath);
    await copyDirectory(localPath, libDir, async function(filepath) {
      filepath = path.relative(localPath, filepath);
      return !npmignore.ignores(filepath);
    });
  }

  // replace the local scoped imports to be relative paths based on their location in the build directory
  const filesToReconfigure = await glob(path.join(tmpPackDir, '**', '*.*'), {
    dot: true
  });
  for (const filepath of filesToReconfigure) {
    if (babel.DEFAULT_EXTENSIONS.includes(path.parse(filepath).ext)) {
      let code = (await fs.readFile(filepath)).toString();
      for (const localDep in localDirs) {
        const localDir = localDirs[localDep];
        const relPath = path.relative(path.parse(filepath).dir, localDir);
        const reg = new RegExp(localDep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        code = _.replace(code, reg, relPath);
      }
      await writeFileIfNotExist(filepath, code);
    }
  }

  // write the final package
  await writeJSONToFile(myTmpPackPath, myTmpPack);

  // pack the project
  const tarballDir = path.join(myProject.local_path, '.poly', 'build');
  let buildFailed = false;
  let tarballPath;
  let hash;
  try {
    tarballPath = await pack(tmpPackDir, tarballDir);
    repo.projects[myProjectName] = tarballPath;
    hash = await doHash(myProject);
  } catch (e) {
    buildFailed = true;
    hash = 'failed';
    tarballPath = myProject.tarball;
    console.log(e);
  }

  myProject.tarball = tarballPath;
  myProject.hash = hash;
  repo.projects[myProjectName] = myProject;
  await writeJSONToFile(repoPath, repo);

  if (buildFailed) {
    throw Error('build failed');
  }

  const tmpDir = path.join(repoDir, '.poly', 'tmp');
  await rimraf(tmpDir);

  return true;
}

///////////////////////////////////////////////////////////////////////////////

async function doHash(project) {
  return await hashDirectory(project.local_path, ['node_modules']);
}

async function copyDirectory(from, to, filter) {
  const globPattern = path.join(from, '**', '*');
  let filesToCopy;
  if (filter) {
    if (typeof filter === 'function') {
      const res = await glob(globPattern, {
        dot: true
      });
      filesToCopy = [];
      for (const filepath of res) {
        if (await filter(filepath)) {
          filesToCopy.push(filepath);
        }
      }
    } else {
      filesToCopy = await glob(globPattern, filter);
    }
  } else {
    filesToCopy = await glob(globPattern, {
      dot: true
    });
  }

  for (const filepath of filesToCopy) {
    if (await isFile(filepath)) {
      const oldRel = path.relative(from, filepath);
      const newPath = path.resolve(to, oldRel);
      await moveFile(filepath, newPath, true);
    }
  }
}

async function getDepVersions(packOb, repo, appRootPath, depVersions = {__locals: {}}) {
  for (const dep in packOb.dependencies) {
    const depVal = packOb.dependencies[dep];
    if (!depVersions[dep]) {
      depVersions[dep] = [];
    }
    if (semver.validRange(depVal)) {
      let didIntersect = false;
      for (const version of depVersions[dep]) {
        if (semver.intersects(version, depVal)) {
          didIntersect = true;
          break;
        }
      }
      if (!didIntersect) {
        depVersions[dep].push(depVal);
      }
    } else {
      depVersions[dep].push(depVal);
    }
  }

  let localDeps = [];
  if (Array.isArray(packOb.localDependencies)) {
    localDeps = localDeps.concat(packOb.localDependencies);
  }
  for (const localProjectName of localDeps) {
    depVersions.__locals[localProjectName] = true;
    const localProject = repo.projects[localProjectName];
    const localProjectDir = localProject.local_path;
    if (localProjectDir) {
      const lp = await findPackage(localProjectDir);
      const depPack = lp.pack;
      depVersions = await getDepVersions(depPack, repo, appRootPath, depVersions);
    }
  }

  return depVersions;
}

async function getNpmignore(projectDir) {
  let npmignore;
  try {
    npmignore = await fs.readFile(path.resolve(projectDir, '.npmignore'));
  } catch (e) {
    console.log(`.npmignore not found for local project in "${projectDir}". Falling back to .gitignore`);
    npmignore = await fs.readFile(path.resolve(projectDir, '.gitignore'));
  }
  npmignore = npmignore.toString();
  npmignore = npmignore.split('\n');
  npmignore = ignore().add(npmignore);
  return npmignore;
}