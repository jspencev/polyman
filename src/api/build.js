import { 
  copyDirectory,
  findInMyDependencies,
  findRepository,
  getBuiltTarballDir,
  getBuiltTarballPath,
  getDependenciesDir,
  getTmpDir,
  hashDirectory,
  isSameRepo,
  readJSONFile,
  scopify,
  yarn
} from '%/util';
import { findPackage, getAppRootPath, writeFileIfNotExist, randomString, isFile, mkdirIfNotExist, writeJSONToFile } from '@jspencev/node-util';
import { sortObject, pushUnique, fallback } from '@jspencev/util';
import pack from './private/pack';
import _ from 'lodash';
import path from 'path';
import semver from 'semver';
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
import tar from 'tar';
import chalk from 'chalk';
import { intersect as rangeIntersect } from 'semver-range-intersect';

const LOCALS_DIR = '.poly_lib';
const DEFAULT_EXTENSIONS = [".js", ".jsx", ".es6", ".es", ".mjs", "cjs"];

export default async function build(config = {}, cwd) {
  // get the project dir and package
  const myProjectDir = await getAppRootPath(cwd);
  const {pack: myPack} = await findPackage(myProjectDir);
  const myProjectName = myPack.name;
  
  const myDepsDir = getDependenciesDir(myProjectDir);
  const toFilterOut = [];
  for (const dep of myPack.localDevDependencies) {
    const tarball = await findInMyDependencies(myProjectDir, dep);
    toFilterOut.push(tarball);
  }
  function hashDirFilter(filepath) {
    const dir = path.parse(filepath).dir;
    if (myDepsDir === dir && toFilterOut.includes(filepath)) {
      return false;
    }
    return true;
  }

  const {sameRepo, repoName} = await isSameRepo(myProjectDir);

  if (!config.force && sameRepo) {
    const {repo} = await findRepository(myProjectDir);
    const project = repo.projects[myProjectName];
    let dirHash;
    if (config.dir_hashes && config.dir_hashes[myProjectName]) {
      dirHash = config.dir_hashes[myProjectName]
    } else {
      dirHash = await hashDirectory(project.local_path, hashDirFilter);
    }
    if (project.dir_hash === dirHash) {
      const tarballPath = await getBuiltTarballPath(myProjectDir);
      return {didBuild: false, tarballPath, dirHash};
    }
  }

  // set up temporary build directory
  const myTmpDir = getTmpDir(myProjectDir);
  const tmpPackDir = path.join(myTmpDir, randomString(8));
  await mkdirIfNotExist(tmpPackDir);

  // extract versions from my package.json
  const versions = extractDepVersions(myPack);

  // unpack all dependency tarballs in separate temporary directories and extract their dependency versions and bin scripts pointing to the .poly_lib directory
  const binScripts = {};
  const localDeps = [];
  for (const dep of myPack.localDependencies) {
    const tarballFile = await findInMyDependencies(myProjectDir, dep);
    const dirBase = path.join(myTmpDir, randomString(8));
    await mkdirIfNotExist(dirBase);
    await tar.extract({
      file: tarballFile,
      cwd: dirBase
    });

    const tmpDir = path.join(dirBase, 'package');
    const pack = await readJSONFile(path.join(tmpDir, 'package.json'));
    extractDepVersions(pack, versions);
    if (pack.bin) {
      for (const scriptName in pack.bin) {
        let scriptPath = pack.bin[scriptName];
        scriptPath = path.join(LOCALS_DIR, scriptPath);
        binScripts[scriptName] = scriptPath;
      }
    }

    const scopedName = scopify(dep, repoName);
    const localDir = path.join(tmpPackDir, '.poly_lib', scopedName);

    localDeps.push({
      name: dep,
      scoped_name: scopedName,
      tmp_dir: tmpDir,
      local_dir: localDir
    });
  }

  // make sure there's no dependency conflicts and generate new dependency range values
  let newDeps = {};
  for (const dep in versions) {
    const version = versions[dep];
    const err = Error(`There's a version conflict between your local packages. Dependency: ${dep} Versions: ${version.ranges}`);
    if (version.semver) {
      const intersection = rangeIntersect(...version.ranges);
      if (intersection === null) {
        throw err;
      }
      newDeps[dep] = intersection;
    } else {
      if (version.ranges.length > 1) {
        throw err;
      }
      newDeps[dep] = version.ranges[0];
    }
  }

  // add corejs 3 to the project if it's not already there
  if (!newDeps['core-js']) {
    newDeps['core-js'] = '3';
  }

  newDeps = sortObject(newDeps);

  // call the yarn build script if exists
  if (myPack.scripts.build) {
    await yarn('build', myProjectDir);
  }

  console.log(chalk.magenta('Prepping production package'));

  // get the npmignore (fallback to gitignore)
  let npmignore;
  try {
    npmignore = await fs.readFile(path.resolve(myProjectDir, '.npmignore'));
  } catch (e) {
    console.log(`.npmignore not found for local project in "${myProjectDir}". Falling back to .gitignore`);
    npmignore = await fs.readFile(path.resolve(myProjectDir, '.gitignore'));
  }
  npmignore = npmignore.toString();
  npmignore = ignore().add(npmignore);

  // copy all unignored files into the tmp build directory
  await copyDirectory(myProjectDir, tmpPackDir, async function(file) {
    file = path.relative(myProjectDir, file);
    const shouldSkip = (npmignore.ignores(file) || file.includes('.git'));
    return !shouldSkip;
  });

  // get the package.json in the temporary build directory and write new data
  const {pack: myTmpPack, packPath: myTmpPackPath} = await findPackage(tmpPackDir);
  myTmpPack.dependencies = newDeps;
  myTmpPack.bin = Object.assign(binScripts, myTmpPack.bin);
  await writeJSONToFile(myTmpPackPath, myTmpPack);

  // rewrite the files to point @repo/project to .poly_lib
  const filesToReconfigure = await glob(path.join(tmpPackDir, '**', '*.*'), {
    dot: true
  });
  for (const file of filesToReconfigure) {
    if (DEFAULT_EXTENSIONS.includes(path.parse(file).ext)) {
      let code = (await fs.readFile(file)).toString();
      for (const localDep of localDeps) {
        const relPath = path.relative(path.parse(file).dir, localDep.local_dir);
        const reg = new RegExp(localDep.scoped_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        code = code.replace(reg, relPath);
      }
      await writeFileIfNotExist(file, code);
    }
  }

  // copy local dependencies into .poly_lib folders
  for (const localDep of localDeps) {
    await copyDirectory(localDep.tmp_dir, localDep.local_dir);
  }

  // write a babel config to transform the code
  const babelConfig = {
    presets: [],
    plugins: []
  };

  const nvmrcPath = path.join(myProjectDir, '.nvmrc');
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

  // transform the code into a new temporary directory
  const finalPackDir = path.join(myTmpDir, randomString(8));
  await mkdirIfNotExist(finalPackDir);

  await babelDir({
    babelOptions: babelConfig,
    cliOptions: {
      filenames: [tmpPackDir],
      outDir: finalPackDir,
      copyFiles: true,
      copyIgnored: true
    }
  });

  // pack the project
  const builtTarballDir = await getBuiltTarballDir(myProjectDir);
  const tarballPath = await pack(finalPackDir, builtTarballDir);
  let dirHash;
  if (sameRepo) {
    // generate hashes and write to the repository
    const {repo, repoPath} = await findRepository(myProjectDir);
    const myProject = repo.projects[myProjectName];
    myProject.tarball = tarballPath;
    dirHash = await hashDirectory(repo.projects[myProjectName].local_path, hashDirFilter);
    myProject.dir_hash = dirHash;
    repo.projects[myProjectName] = myProject;
    await writeJSONToFile(repoPath, repo);
  }

  // cleanup
  await rimraf(myTmpDir);
  return {didBuild: true, tarballPath, dirHash};
}

///////////////////////////////////////////////////////////////////////////////

function extractDepVersions(pack, versions = {}) {
  for (const dep in pack.dependencies) {
    if (!versions[dep]) {
      versions[dep] = {
        semver: true,
        ranges: []
      };
    }

    const depVersion = pack.dependencies[dep];
    if (!semver.validRange(depVersion)) {
      versions[dep].semver = false;
    }

    pushUnique(versions[dep].ranges, depVersion);
  }

  return versions;
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