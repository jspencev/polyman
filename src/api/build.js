import { yarn, hashDirectory, findRepository, generatePolymanDeps, isRepoProject, writeJSONToFile } from '../util';
import { findPackage } from '@carbon/node-util';
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import pack from './private/pack';
const _ = require('lodash');

export default async function build(config, cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  const repoDir = path.parse(repoPath).dir;
  const fp = await findPackage(cwd);
  const myPack = fp.pack;
  const myPackPath = fp.packPath;
  const myPackDir = path.parse(myPackPath).dir;
  const originalPack = _.cloneDeep(myPack);
  const packPath = fp.packPath;
  const projectName = myPack.name;
  let project = repo.projects[projectName];
  
  if (!config.force && false) { // for now, builds always run
    const hash = await doHash(project);
    if (project.hash === hash) {
      return false;
    }
  }

  const tarballDir = path.join(project.local_path, '.poly', 'build');
  let buildFailed = false;
  let tarballPath;
  let hash;
  try {
    await yarn('build', myPackDir);
    tarballPath = await pack(myPackDir, tarballDir);
    repo.projects[projectName] = tarballPath;

    for (const dep in myPack.dependencies) {
      if (isRepoProject(dep, repo)) {
        delete myPack.dependencies[dep];
      }
    }
    for (const devDep in myPack.devDependencies) {
      if (isRepoProject(devDep, repo)) {
        delete myPack.devDependencies[devDep];
      }
    }
    await writeJSONToFile(packPath, myPack);
    let localTarballDir = path.resolve(repoDir, '.poly', 'build');
    await pack(myPackDir, localTarballDir);
    hash = await doHash(project);
  } catch (e) {
    buildFailed = true;
    hash = 'failed';
    tarballPath = project.tarball;
    console.log(e);
  }
  
  // revert package.json to original
  await writeJSONToFile(packPath, originalPack);

  project.tarball = tarballPath;
  project.hash = hash;
  project = await generatePolymanDeps(repo, project);
  repo.projects[projectName] = project;
  await writeJSONToFile(repoPath, repo);

  if (buildFailed) {
    throw Error('build failed');
  }

  return true;
}

async function doHash(project) {
  return await hashDirectory(project.local_path, ['node_modules']);
}