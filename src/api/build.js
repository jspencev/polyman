import { yarn, hashDirectory, findRepository, findProjectByLocalPath, generatePolymanDeps, cleanYarnLock, deleteFromYarnCache } from '../util';
import { findPackage } from '@carbon/node-util';
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import pack from './private/pack';

export default async function build(config, cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  const {packPath} = await findPackage(cwd);
  const packDir = path.parse(packPath).dir;
  let {project, projectName} = findProjectByLocalPath(repo, packDir);
  if (!config.force) {
    const hash = await doHash(project);
    if (project.hash === hash) {
      return false;
    }
  }
  await deleteFromYarnCache(`@${repo.name}/${projectName}`);
  await cleanYarnLock(cwd);

  const tarballDir = path.join(packDir, '.poly', 'build');
  let buildFailed = false;
  let tarballPath;
  let hash;
  try {
    await yarn('build', project.local_path);
    hash = await doHash(project);
    tarballPath = await pack(project, tarballDir);
  } catch (e) {
    buildFailed = true;
    hash = 'failed';
    tarballPath = project.tarball;
  }
  
  project.tarball = tarballPath;
  project.hash = hash;
  project = await generatePolymanDeps(repo, project);
  repo.projects[projectName] = project;
  await fs.writeFile(repoPath, JSON.stringify(repo, null, 2));

  await deleteFromYarnCache(`@${repo.name}/${projectName}`);
  await cleanYarnLock(cwd);

  if (buildFailed) {
    throw Error('build failed');
  }

  return true;
}

async function doHash(project) {
  return await hashDirectory(project.local_path, ['node_modules', '.poly']);
}