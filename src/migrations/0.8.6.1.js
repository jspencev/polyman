import { findRepository, isSameRepo } from '%/util';
import { writeJSONToFile, readJSONFile } from '@jspencev/node-util';
import { sortObject } from '@jspencev/util';
import path from 'path';

export async function repoUp(repoDir) {
  return true;
}

export async function repoDown(repoDir) {
  return false;
}

export async function projectUp(projectDir) {
  const {sameRepo} = await isSameRepo(projectDir);
  if (!sameRepo) {
    return false;
  }

  const {repo} = await findRepository(projectDir);
  const polyConfigFile = path.join(projectDir, 'config.poly');
  let polyConfig;
  try {
    polyConfig = await readJSONFile(polyConfigFile);
  } catch (e) {
    polyConfig = {
      babel: false
    };
  }
  polyConfig.version = 'foo';
  polyConfig.repository_name = repo.name;
  polyConfig = sortObject(polyConfig);
  await writeJSONToFile(polyConfigFile, polyConfig);

  return true;
}

export async function projectDown(projectDir) {
  const {sameRepo} = await isSameRepo(projectDir);
  if (!sameRepo) {
    return false;
  }

  const polyConfigFile = path.join(projectDir, 'config.poly');
  const polyConfig = await readJSONFile(polyConfigFile);
  delete polyConfig.version;
  delete polyConfig.repository_name;
  await writeJSONToFile(polyConfigFile, polyConfig);

  return true;
}