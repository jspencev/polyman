import { yarn, hashDirectory, findRepository, findProjectByLocalPath, generatePolymanDeps, isRepoProject, writeJSONToFile, getLocalTarballPath } from '../util';
import { findPackage } from '@carbon/node-util';
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import pack from './private/pack';
const _ = require('lodash');

export default async function build(config, cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  const fp = await findPackage(cwd);
  const myPack = fp.pack;
  const originalPack = _.cloneDeep(myPack);
  const packPath = fp.packPath;
  const packDir = path.parse(packPath).dir;
  let {project, projectName} = findProjectByLocalPath(repo, packDir);
  if (!config.force && false) { // for now, builds always run
    const hash = await doHash(project);
    if (project.hash === hash) {
      return false;
    }
  }

  const tarballDir = path.join(packDir, '.poly', 'build');
  let buildFailed = false;
  let tarballPath;
  let hash;
  try {
    await yarn('build', project.local_path);
    tarballPath = await pack(project, tarballDir);

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
    let localTarballDir = getLocalTarballPath(projectName, repo, repoPath);
    localTarballDir = path.parse(localTarballDir).dir;
    await pack(project, localTarballDir);
    hash = await doHash(project);
  } catch (e) {
    buildFailed = true;
    hash = 'failed';
    tarballPath = project.tarball;
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