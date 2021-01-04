import { findRepository, addDependenciesToProject } from '../util';
import { findPackage } from '@carbon/node-util';
import { fallback, concatMoveToBack, concatMoveToFront } from '@carbon/util';
import build from './build';
import relink from './relink';
const chalk = require('chalk');

export default async function bootstrap(config, cwd) {
  console.warn(chalk.yellow('DO NOT EXIT THIS PROCESS!'));
  console.warn(chalk.yellow('PAIN AND SUFFERING AWAITS THOSE WHO EXIT THIS PROCESS.'));

  const {repo} = await findRepository(cwd);
  let pack;
  try {
    ({pack} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    config.all = true;
    throw Error('Cannot bootstrap all yet. TODO');
  }

  const myProjectName = pack.name;
  let myProject = repo.projects[myProjectName];

  // ensure that the repository project dependencies and the starting package dependencies match
  myProject = await addDependenciesToProject(myProject, pack, repo, true);
  repo.projects[myProjectName] = myProject;

  // get a list of all projects connected to my project
  const connectedProjects = getConnectedProjects(myProjectName, repo, true, false, [myProjectName]);
  const projectMap = {};
  for (const connectedProject of connectedProjects) {
    const deps = {};
    const projectData = repo.projects[connectedProject];
    if (Array.isArray(projectData.local_dependencies)) {
      deps.dependencies = fallback(projectData.local_dependencies, []);
    } else {
      deps.dependencies = fallback(Object.keys(projectData.local_dependencies), []);
    }
    if (Array.isArray(projectData.local_dev_dependencies)) {
      deps.dev_dependencies = fallback(projectData.local_dev_dependencies, []);
    } else {
      deps.dev_dependencies = fallback(Object.keys(projectData.local_dev_dependencies), []);
    }
    deps.build_dependencies = fallback(projectData.build_dependencies, []);
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
    await build(config, localPath);
  }
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Get all local projects connected via local dependency to the given project. Projects will only appear once in output.
 * @param {String} projectName - Name of the project to get connected projects for.
 * @param {*} repo - Repository object.
 * @param {Boolean} dev - Should include dev dependencies? Default: false.
 * @param {Boolean} passDev - Should include dev dependencies of found dependencies and devDependencies. Only works if dev = true. Default: false;
 * @param {Array<String>} connectedProjects - Initial connectedProjects. Pass [<PROJECT NAME>] to include your project in the array. It will remain the first element in the return. Default: [].
 * @returns {Array<String>} - Array of found dependencies. In found order, not tree order.
 */
function getConnectedProjects(projectName, repo, dev = false, passDev = false, connectedProjects = []) {
  const project = repo.projects[projectName];
  let allDeps = [];
  if (project.local_dependencies) {
    if (Array.isArray(project.local_dependencies)) {
      allDeps = allDeps.concat(project.local_dependencies);
    } else {
      allDeps = allDeps.concat(Object.keys(project.local_dependencies));
    }
  }
  if (dev && project.local_dev_dependencies) {
    if (Array.isArray(project.local_dev_dependencies)) {
      allDeps = allDeps.concat(project.local_dev_dependencies);
    } else {
      allDeps = allDeps.concat(Object.keys(project.local_dev_dependencies));
    }
  }
  for (const dep of allDeps) {
    if (!connectedProjects.includes(dep)) {
      connectedProjects.push(dep);
      const args = [dep, repo];
      if (passDev) {
        args.push(dev);
      } else {
        args.push(false);
      }
      args.push(passDev);
      args.push(connectedProjects);
      connectedProjects = getConnectedProjects(...args);
    }
  }
  return connectedProjects;
}

function getRunOrder(projectName, projectMap) {
  let {runOrder, hitProject} = generateRunOrder(projectName, projectMap, []);
  if (runOrder[runOrder.length - 1] !== projectName) {
    runOrder.push(projectName);
  }

  hitProject[projectName] = false;
  for (const devDep of projectMap[projectName].dev_dependencies) {
    const gro = generateRunOrder(devDep, projectMap, [devDep], hitProject);
    hitProject = gro.hitProject;
    const ro = gro.runOrder;
    if (ro[ro.length - 1] !== devDep) {
      ro.push(devDep);
    }
    for (const item of ro) {
      if (!runOrder.includes(item)) {
        runOrder = concatMoveToBack(runOrder, [item]);
      }
    }
  }

  if (runOrder[runOrder.length - 1] !== projectName) {
    runOrder.push(projectName);
  }
  
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