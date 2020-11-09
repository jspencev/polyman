import hashDirectory from './hashDirectory';
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));

/**
 * Organizes dependencies in package.json into dependencies data for the polyman repository
 * @param {*} repo - Repo object
 * @param {*} project - Project object to organize dependencies for
 * @returns {*} - Project updated with organized dependencies
 */
export default async function generatePolymanDeps(repo, project) {
  if (project.local_path) {
    const packPath = path.join(project.local_path, 'package.json');
    const pack = JSON.parse((await fs.readFile(packPath)).toString());

    const orgDeps = await orgDependencies(repo, pack.dependencies);
    const orgDevDeps = await orgDependencies(repo, pack.devDependencies);
    project.dependencies = orgDeps.deps;
    project.dev_dependencies = orgDevDeps.deps;
    project.local_dependencies = orgDeps.localDeps;
    project.local_dev_dependencies = orgDevDeps.localDeps;
    return project;
  }
}

async function orgDependencies(repo, dependencies) {
  const deps = {};
  const localDeps = {};
  for (const dependency in dependencies) {
    const depVal = dependencies[dependency];
    const repoScope = `@${repo.name}/`;
    if (dependency.includes(repoScope)) {
      const projectName = dependency.split(repoScope)[1];
      const project = repo.projects[projectName];
      if (project && project.local_path) {
        // this is a local project
        const hash = await hashDirectory(project.local_path, ['node_modules']);
        localDeps[projectName] = hash;
        continue;
      }
    }
    deps[dependency] = depVal;
  }

  return {deps, localDeps};
}