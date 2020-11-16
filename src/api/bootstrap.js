import { findRepository, findProjectByLocalPath, getConnectedProjects, generatePolymanDeps } from '../util';
import { findPackage } from '@carbon/node-util';
import { fallback, concatMoveToBack, concatMoveToFront } from '@carbon/util';
const path = require('path');
import local from './local';
import build from './build';
import relink from './relink';
const chalk = require('chalk');

export default async function bootstrap(config, cwd) {
  console.warn(chalk.yellow('DO NOT EXIT THIS PROCESS!'));
  console.warn(chalk.yellow('PAIN AND SUFFERING AWAITS THOSE WHO EXIT THIS PROCESS.'));

  const {repo} = await findRepository(cwd);
  let packPath;
  let pack;
  try {
    ({pack, packPath} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    config.all = true;
    throw Error('Cannot bootstrap all yet. TODO');
  }

  const projectDir = path.parse(packPath).dir;
  const me = findProjectByLocalPath(repo, projectDir);
  const myProjectName = me.projectName;

  // ensure that the repository project dependencies and the starting package dependencies match
  repo.projects[myProjectName] = await generatePolymanDeps(repo, repo.projects[myProjectName], pack);

  // get a list of all projects connected to my project
  const connectedProjects = getConnectedProjects(myProjectName, repo, true, false, [myProjectName]);
  const projectMap = {};
  for (const connectedProject of connectedProjects) {
    const deps = {};
    const projectData = repo.projects[connectedProject];
    deps.dependencies = Object.keys(fallback(projectData.local_dependencies, {}));
    deps.dev_dependencies = Object.keys(fallback(projectData.local_dev_dependencies, {}));
    deps.build_dependencies = Object.keys(fallback(projectData.build_dependencies, {}));
    const buildDeps = [];
    for (const buildDep of deps.build_dependencies) {
      if (!deps.dependencies.includes(buildDep)) {
        buildDeps.push(buildDep);
      }
    }
    deps.build_dependencies = buildDeps;
    projectMap[connectedProject] = deps;
  }

  const runOrder = getRunOrder(myProjectName, projectMap);

  // add dependencies up the dependency tree and rebuild each connected project
  for (const projectName of runOrder) {
    console.warn(chalk.yellow('DO NOT EXIT THIS PROCESS!'));
    const localPath = repo.projects[projectName].local_path;
    console.log(chalk.cyan('cd ' + localPath));
    console.log(chalk.cyan('poly relink'));
    await relink({}, localPath);
    console.log(chalk.cyan('poly build'));
    config.force = true;
    await build(config, localPath);
  }
}

function getRunOrder(projectName, projectMap) {
  let {runOrder, hitProject} = generateRunOrder(projectName, projectMap, []);
  hitProject[projectName] = false;
  for (const devDep of projectMap[projectName].dev_dependencies) {
    const gro = generateRunOrder(devDep, projectMap, [devDep], hitProject);
    hitProject = gro.hitProject;
    for (const item of gro.runOrder) {
      if (!runOrder.includes(item)) {
        runOrder = concatMoveToBack(runOrder, [devDep]);
      }
    }
  }

  if (runOrder[runOrder.length - 1] !== projectName) {
    runOrder.push(projectName);
  }

  console.log(runOrder);
  
  return runOrder;
}

function generateRunOrder(projectName, projectMap, runOrder = [], hitProject = {}) {
  if (!hitProject[projectName]) {
    hitProject[projectName] = true;

    const deps = projectMap[projectName].dependencies.concat(projectMap[projectName].build_dependencies);
    runOrder = concatMoveToFront(runOrder, deps);
    for (const dep of deps) {
      ({runOrder, hitProject} = generateRunOrder(dep, projectMap, runOrder, hitProject));
    }
  }
  return {runOrder, hitProject};
}