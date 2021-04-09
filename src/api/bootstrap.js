import { findRepository, hashDirectory } from '%/util';
import { findPackage } from '@jspencev/node-util';
import build from './build';
import relink from './relink';
import chalk from 'chalk';
import _ from 'lodash';

export default async function bootstrap(config = {}, cwd) {
  console.log(chalk.yellow('DO NOT EXIT THIS PROCESS!'));
  console.log(chalk.yellow('PAIN AND SUFFERING AWAITS THOSE WHO EXIT THIS PROCESS.'));

  const {repo} = await findRepository(cwd);

  let pack;
  try {
    ({pack} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    config.all = true;
  }

  const toBootstrap = [];
  if (config.all) {
    for (const projectName in repo.projects) {
      const project = repo.projects[projectName];
      if (project.local_path) {
        toBootstrap.push(projectName);
      }
    }
  } else {
    toBootstrap.push(pack.name);
  }

  const dirHashes = {};
  for (const projectName of toBootstrap) {
    await runBootstrap(projectName, repo, dirHashes, config.force);
  }
}

async function runBootstrap(projectName, repo, dirHashes, force, dev = true, exclude = [], indent = 0) {
  const toExclude = _.union(exclude, [projectName]);
  const project = repo.projects[projectName];
  const {pack} = await findPackage(project.local_path);
  let toRun = [];
  if (pack.localDependencies) {
    toRun = pack.localDependencies;
  }
  if (project.build_dependencies) {
    toRun = _.union(toRun, project.build_dependencies);
  }
  _.pullAll(toRun, toExclude);
  for (const name of toRun) {
    await runBootstrap(name, repo, dirHashes, force, false, toExclude, indent + 1);
  }

  let toExec = [projectName];
  if (dev) {
    if (pack.localDevDependencies) {
      toExec = _.union(toExec, pack.localDevDependencies);
    }
    if (project.build_dependencies) {
      _.pullAll(toExec, project.build_dependencies);
    }
    toExec.push(projectName);
  }

  const config = {force: force};
  for (const name of toExec) {
    console.log(chalk.magenta(`== ${indent}: Bootstrapping ${name}`));
    console.log(chalk.yellow('DO NOT EXIT THIS PROCESS!'));

    const localPath = repo.projects[name].local_path;
    console.log(chalk.cyan('cd ' + localPath));

    console.log(chalk.cyan('poly relink'));
    const {didRelink} = await relink(config, localPath);
    if (didRelink) {
      dirHashes[name] = null;
    }

    console.log(chalk.cyan('poly build'));
    config.dir_hashes = dirHashes;
    const {didBuild, dirHash} = await build(config, localPath);
    dirHashes[name] = dirHash;
  }
}