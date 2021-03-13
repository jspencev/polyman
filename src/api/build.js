import { yarn, findRepository, writeJSONToFile, scopify, hashDirectory, getBuiltTarballDir, getBuiltTarballPath, copyDirectory } from '%/util';
import { findPackage, getAppRootPath, writeFileIfNotExist, randomString, moveFile, isFile } from '@jspencev/node-util';
import { sortObject, isOneTruthy } from '@jspencev/util';
import pack from './private/pack';
import _ from 'lodash';
import path from 'path';
import semver from 'semver';
import * as babel from '@babel/core';
import thenify from 'thenify';
import _rimraf from 'rimraf';
const rimraf = thenify(_rimraf);
import _glob from 'glob';
const glob = thenify(_glob);
import thenifyAll from 'thenify-all';
import _fs from 'fs';
const fs = thenifyAll(_fs);
import ignore from 'ignore';
import babelDir from '@babel/cli/lib/babel/dir';
import gitignoreToGlob from 'gitignore-to-glob';
import md5 from 'md5';

const LOCALS_DIR = '.poly_lib';

export default async function build(config = {}, cwd) {
  const appRootPath = await getAppRootPath(cwd);
  const {repo, repoPath} = await findRepository(cwd);
  const repoDir = path.parse(repoPath).dir;

  // get the package from the local repository
  const mp = await findPackage(cwd);
  const myPack = mp.pack;
  const myProjectName = myPack.name;
  let myProject = repo.projects[myProjectName];
  
  if (!config.force) {
    const hash = await hashDirectory(myProject.local_path);
    if (myProject.dir_hash === hash) {
      const tarballPath = await getBuiltTarballPath(appRootPath);
      return {didBuild: false, tarballPath};
    }
  }

  // build the project where it is
  await yarn('build', appRootPath);

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
      const shouldCopy = !isOneTruthy(
        npmignore.ignores(filepath),
        filepath.includes('.git')
      );
      return shouldCopy;
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

  // add corejs 3 to the project
  // await add(['core-js'], {}, tmpPackDir);
  if (!myTmpPack.dependencies['core-js']) {
    myTmpPack.dependencies['core-js'] = '3';
  }

  // write a babel config to transform the code
  const babelConfig = {
    presets: [],
    plugins: []
  };

  const nvmrcPath = path.join(appRootPath, '.nvmrc');
  const presetEnv = {
    useBuiltIns: 'usage',
    corejs: 3
  };
  let nodeVersion;
  if (await isFile(nvmrcPath)) {
    const nvmrc = await fs.readFile(nvmrcPath);
    nodeVersion = +nvmrc;
  }
  if (nodeVersion) {
    presetEnv.targets = {
      node: nodeVersion
    }
  }
  babelConfig.presets.push([
    await findModuleAbsolutePath('@babel/preset-env'),
    presetEnv
  ]);

  babelConfig.plugins.push([
    await findModuleAbsolutePath('babel-plugin-minify-dead-code-elimination'), {
      keepFnName: true,
      keepClassName: true,
      keepFsArgs: true,
      tdz: true
    }
  ]);

  const npmignorePath = path.resolve(tmpPackDir, '.npmignore')
  let babelIgnore = [];
  if (await isFile(npmignorePath)) {
    babelIgnore = gitignoreToGlob(npmignorePath);
  }

  const finalPackDir = path.join(repoDir, '.poly', 'tmp', randomString(8));

  await babelDir({
    babelOptions: babelConfig,
    cliOptions: {
      filenames: [tmpPackDir],
      outDir: finalPackDir,
      copyFiles: true,
      copyIgnored: true,
      ignore: babelIgnore
    }
  });

  // write the final package
  await writeJSONToFile(path.join(finalPackDir, 'package.json'), myTmpPack);

  // pack the project

  let buildFailed = false;
  let tarballPath;
  let dirHash;
  let tarballHash;
  try {
    const builtTarballDir = await getBuiltTarballDir(appRootPath);
    tarballPath = await pack(finalPackDir, builtTarballDir);
    repo.projects[myProjectName] = tarballPath;
    dirHash = await hashDirectory(myProject.local_path);
    tarballHash = md5(await fs.readFile(tarballPath));
  } catch (e) {
    buildFailed = true;
    dirHash = 'failed';
    tarballHash = 'failed';
    tarballPath = myProject.tarball;
    console.log(e);
  }

  myProject.tarball = tarballPath;
  myProject.dir_hash = dirHash;
  myProject.tarball_hash = tarballHash;
  repo.projects[myProjectName] = myProject;
  await writeJSONToFile(repoPath, repo);

  if (buildFailed) {
    throw Error('build failed');
  }

  const tmpDir = path.join(repoDir, '.poly', 'tmp');
  await rimraf(tmpDir);

  return {didBuild: true, tarballPath};
}

///////////////////////////////////////////////////////////////////////////////

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
  npmignore = ignore().add(npmignore);
  return npmignore;
}

async function findModuleAbsolutePath(mod) {
  const parsed = path.parse(__dirname);
  const root = parsed.root
  let dirs = parsed.dir.slice(root.length);
  dirs = dirs.split(path.sep);
  while (dirs.length > 0) {
    let modDir;
    if (mod.charAt(0) === '@') {
      modDir = mod.split('/');
    } else {
      modDir = [mod];
    }
    const modPath = root + path.join(...dirs, 'node_modules', ...modDir);
    const check = root + path.join(modPath, 'package.json');
    if (await isFile(check)) {
      return modPath;
    }

    dirs.pop();
  }

  throw Error('Module could not be found.');
}