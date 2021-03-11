import { yarn, findRepository, readJSONFile, isSameRepo } from '%/util'
import { findPackage } from '@jspencev/node-util';
import path from 'path';
import { relink, build } from '%/api';

export default async function install(config, cwd) {
  const {pack, packPath} = await findPackage(cwd);
  const projectDir = path.parse(packPath).dir;
  const {sameRepo, repoName} = await isSameRepo(projectDir);

  const yarnCmd = ['install'];
  if (config.production) {
    yarnCmd.push('--production');
  }
  await yarn(yarnCmd, cwd);

  // if (rightRepo) {
  //   await relink({force: true, production: config.production}, cwd);
  // } else {
  //   let localDepsToAdd = pack.local_dependencies;
  //   if (!config.production) {
  //     localDepsToAdd = localDepsToAdd.concat(pack.local_dev_dependencies);
  //   }
  // }

  // if (!config.production) {
  //   await build({force: true}, cwd);
  // }
}