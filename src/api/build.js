import { findPackage, yarn, hashDirectory, findRepository, findProjectByLocalPath } from '../util';
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));

export default async function build(config, cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  const {packPath} = await findPackage(cwd);
  const packDir = path.parse(packPath).dir;
  const {project, projectName} = findProjectByLocalPath(repo, packDir);
  if (!config.force) {
    const hash = await doHash(project);
    if (project.hash !== hash) {
      config.force = true;
    } else {
      console.log(`Skipping build for "${projectName}": no files in the project directory have changed.`);
    }
  }

  if (config.force) {
    await yarn('build', project.local_path);
    const hash = await doHash(project);
    project.hash = hash;
    repo.projects[projectName] = project;
    await fs.writeFile(repoPath, JSON.stringify(repo, null, 2));
  }
}

async function doHash(project) {
  return await hashDirectory(project.local_path, ['node_modules']);
}