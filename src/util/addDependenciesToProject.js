import { sortObject, fallback } from '@jspencev/util';

/**
 * Adds dependencies from the package.json to the submitted project object. Will organize the projects if specified.
 * @param {*} project - The project object.
 * @param {*} pack - Package.json object.
 * @param {*} repo - Repo object.
 * @param {Boolean} organize - Should alphebetize the dependencies? Default: false.
 * @returns {*} - Modified project object.
 */
export default function addDependenciesToProject(project, pack, repo, organize = false) {
  let {dependencies, devDependencies, localDependencies, localDevDependencies} = pack;
  if (organize) {
    dependencies = sortObject(dependencies);
    devDependencies = sortObject(devDependencies);
    localDependencies = localDependencies.sort();
    localDevDependencies = localDevDependencies.sort();
  }

  const localDeps = {};
  const localDevDeps = {};
  for (const localProjectName of localDependencies) {
    localDeps[localProjectName] = repo.projects[localProjectName].tarball_hash;
  }
  for (const localDevProjectName of localDevDependencies) {
    localDevDeps[localDevProjectName] = repo.projects[localDevProjectName].tarball_hash;
  }

  project.dependencies = dependencies;
  project.dev_dependencies = devDependencies;
  project.local_dependencies = localDeps;
  project.local_dev_dependencies = localDevDeps;
  project.build_dependencies = fallback(project.build_dependencies, []);

  return project;
}