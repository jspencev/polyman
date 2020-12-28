import { sortObject } from '@carbon/util';

/**
 * Adds dependencies from the package.json to the submitted project object. Will organize the projects if specified.
 * @param {*} project - The project object.
 * @param {*} pack - Package.json object.
 * @param {Boolean} organize - Should alphebetize the dependencies? Default: false.
 * @returns {*} - Modified project object.
 */
export default function addDependenciesToProject(project, pack, organize = false) {
  let {dependencies, devDependencies, localDependencies, localDevDependencies} = pack;
  if (organize) {
    dependencies = sortObject(dependencies);
    devDependencies = sortObject(devDependencies);
    localDependencies = localDependencies.sort();
    localDevDependencies = localDevDependencies.sort();
  }
  project.dependencies = dependencies;
  project.dev_dependencies = devDependencies;
  project.local_dependencies = localDependencies;
  project.local_dev_dependencies = localDevDependencies;

  return project;
}