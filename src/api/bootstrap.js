import { findRepository, addDependenciesToProject } from '%/util';
import { findPackage } from '@jspencev/node-util';
import { fallback, concatMoveToBack, concatMoveToFront, pushUnique } from '@jspencev/util';
import build from './build';
import relink from './relink';
import chalk from 'chalk';
import _ from 'lodash';

export default async function bootstrap(config = {}, cwd) {
  console.warn(chalk.yellow('DO NOT EXIT THIS PROCESS!'));
  console.warn(chalk.yellow('PAIN AND SUFFERING AWAITS THOSE WHO EXIT THIS PROCESS.'));

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

  for (const projectName of toBootstrap) {
    await runBootstrap(config, repo.projects[projectName].local_path);
  }
}

async function runBootstrap(config, cwd) {
  const {repo} = await findRepository(cwd);
  const {pack} = await findPackage(cwd)

  const myProjectName = pack.name;
  console.log(`Bootstrapping ${myProjectName}...`);
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
    await relink(config, localPath);
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
  if (project.build_dependencies) {
    for (const buildDep of project.build_dependencies) {
      pushUnique(allDeps, buildDep);
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
  const myCriticalDeps = getCriticalDeps(projectName, projectMap);
  let {runOrder, hitProject} = generateRunOrder(projectName, projectMap);

  let nro = [];
  for (const dep of runOrder) {
    const criticalDeps = getCriticalDeps(dep, projectMap);
    criticalDeps.push(dep);
    nro = concatNoDouble(nro, criticalDeps);
  }
  runOrder = concatNoDouble(nro, runOrder);

  let found = false;
  while (!found) {
    if (!myCriticalDeps.includes(_.last(runOrder))) {
      runOrder.pop();
    } else {
      found = true;
    }
  }

  runOrder = _.uniq(runOrder.reverse()).reverse();

  if (_.last(runOrder) !== projectName) {
    runOrder.push(projectName);
  }

  hitProject[projectName] = false;
  for (const devDep of projectMap[projectName].dev_dependencies) {
    const gro = generateRunOrder(devDep, projectMap, [devDep], hitProject);
    hitProject = gro.hitProject;
    const ro = gro.runOrder;
    if (_.last(ro) !== devDep) {
      ro.push(devDep);
    }
    for (const item of ro) {
      if (!runOrder.includes(item)) {
        runOrder = concatMoveToBack(runOrder, [item]);
      }
    }
  }

  if (_.last(runOrder) !== projectName) {
    runOrder.push(projectName);
  }
  
  return runOrder;
}

function generateRunOrder(projectName, projectMap, runOrder = [], hitProject = {}) {
  if (!hitProject[projectName]) {
    hitProject[projectName] = true;

    const deps = getCriticalDeps(projectName, projectMap);
    runOrder = concatMoveToFront(runOrder, deps);
    for (const dep of deps) {
      ({runOrder, hitProject} = generateRunOrder(dep, projectMap, runOrder, hitProject));
    }
  }
  return {runOrder, hitProject};
}

function getCriticalDeps(projectName, projectMap) {
  const deps = projectMap[projectName].dependencies.concat(projectMap[projectName].build_dependencies);
  return deps;
}

function concatNoDouble(...arrs) {
  let final = [];
  for (const arr of arrs) {
    if (_.last(final) === arr[0]) {
      final.pop();
    }
    final = final.concat(arr);
  }
  return final;
}