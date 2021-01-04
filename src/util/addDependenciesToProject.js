import { sortObject } from '@carbon/util';

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
    localDeps[localProjectName] = repo.projects[localProjectName].hash;
  }
  for (const localDevProjectName of localDevDependencies) {
    localDevDeps[localDevProjectName] = repo.projects[localDevProjectName].hash;
  }

  project.dependencies = dependencies;
  project.dev_dependencies = devDependencies;
  project.local_dependencies = localDeps;
  project.local_dev_dependencies = localDevDeps;

  return project;
}