import { findRepository } from '@jspencev/polyman-util'
import { readJSONFile } from '@jspencev/node-util';
import path from 'path';

/**
 * Determines whether the project is currently in the repository that owns it
 * @param {String} projectDir - The project directory
 * @returns {*} - sameRepo {Boolean} - Is in owner repository? repoName {String} - The owning repository of the project.
 */
export default async function isSameRepo(projectDir) {
  const polyConfigFile = path.resolve(projectDir, 'config.poly');
  const polyConfig = await readJSONFile(polyConfigFile);
  const repoName = polyConfig.repository_name;

  let sameRepo;
  try {
    const {repo} = await findRepository(projectDir);
    sameRepo = (repo.name === repoName);
  } catch (e) {
    sameRepo = false;
  }

  return {sameRepo, repoName};
}