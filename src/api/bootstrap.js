import { findRepository, findProjectByLocalPath } from '../util';
import { fallback } from '@carbon/util';
import { findPackage } from '@carbon/node-util';
import local from './local';
import build from './build';
const path = require('path');
const _ = require('lodash');

const TYPES = {
  REGULAR: 'regular',
  DEV: 'dev'
};

export default async function bootstrap(config, cwd) {
  console.warn('DO NOT EXIT THIS PROCESS!');
  console.warn('YOU COULD LOSE REFERENCE TO THE LOCAL DEPENDENCIES ON A PROJECT AND YOU WILL HAVE TO RE-ADD THEM MANUALLY!');

  const {repo} = await findRepository(cwd);
  let packPath;
  try {
    ({packPath} = await findPackage(cwd));
  } catch (e) {
    console.log(`Looks like you're not in a package. Bootstrapping all...`);
    config.all = true;
  }
  
  const projectDir = path.parse(packPath).dir;
  const me = findProjectByLocalPath(repo, projectDir);
  const myProjectName = me.projectName;
  const myProject = me.project;
  let projectNames;
  if (config.bootstrap_round_2) {
    projectNames = config.bootstrap_round_2.failed;
  } else {
    projectNames = Object.keys(repo.projects);
  }
  
  if (!config.all) {
    projectNames = findMyDeps(myProjectName, repo);
  }

  const failedBuilds = [];
  for (const projectName of projectNames) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      try {
        console.log(`Polyman: Building ${projectName}`);
        console.log('-----------------------------------------------------------------');
        await build(config, project.local_path);
      } catch (e) {
        console.error(`Project "${projectName}": build failed.`);
        failedBuilds.push(projectName);
      }
    }

    console.log(`Polyman: Relinking ${projectName}`);
    console.log('-----------------------------------------------------------------');
    if (project.local_path) {
      const {localDeps, localDevDeps} = getDeps(project);
      const depsToRemove = localDeps.concat(localDevDeps);
      if (depsToRemove.length > 0) {
        console.warn('DO NOT EXIT THIS PROCESS!');
        console.warn('YOU COULD LOSE REFERENCE TO THE LOCAL DEPENDENCIES ON A PROJECT AND YOU WILL HAVE TO RE-ADD THEM MANUALLY!');

        await local(depsToRemove, 'remove', config, project.local_path);

        const depsToAdd = localDeps
        if (depsToAdd.length > 0) {
          config.dev = false;
          await local(depsToAdd, 'add', config, project.local_path);
        }
  
        const devDepsToAdd = localDevDeps;
        if (devDepsToAdd.length > 0) {
          config.dev = true;
          await local(devDepsToAdd, 'add', config, project.local_path);
        }
      }
    }
  }
}

function findMyDeps(projectName, repo) {
  let {tree} = genDepTree(projectName, repo);
 
  let finalRunOrder = [];
  let runOrder = [];
  let done = {};
  const randomRun = [];
  while(Object.keys(tree).length > 0) {
    ({runOrder, tree} = determineRunOrder(tree, done));
    finalRunOrder = finalRunOrder.concat(runOrder).concat(randomRun);
    let least = 100000000;
    let chosen;
    for (const node in tree) {
      const d = tree[node];
      if (d.children.length <= least) {
        chosen = node;
        least = d.children.length;
      }
    }
    randomRun.push(chosen);
    done = {};
    done[chosen] = true;
  }
  return finalRunOrder;
}

function genDepTree(projectName, repo, tree = {}, hitProject = {}) {
  if (!hitProject[projectName]) {
    if (!tree[projectName]) {
      tree[projectName] = {
        parents: [],
        children: []
      };
    }
    hitProject[projectName] = true;
    const project = repo.projects[projectName];
    const {localDeps, localDevDeps} = getDeps(project);
    const deps = localDeps.concat(localDevDeps);
    for (const child of deps) {
      if (!tree[child]) {
        tree[child] = JSON.parse(JSON.stringify(tree[projectName]));
      }
      tree[child].parents.push(projectName);
      if (tree[projectName].children.includes(child)) {
        // throw Error('circular dependency');
      } else {
        tree[projectName].children.push(child);
      }
      ({tree, hitProject} = genDepTree(child, repo, tree, hitProject));
    }
  }
  return {tree, hitProject};
}

function getDeps(project) {
  const localDeps = Object.keys(JSON.parse(JSON.stringify(fallback(project.local_dependencies, {}))));
  const localDevDeps = Object.keys(JSON.parse(JSON.stringify(fallback(project.local_dev_dependencies, {}))));
  return {localDeps, localDevDeps};
}

function determineRunOrder(tree, done = {}) {
  let i = 0;
  let runOrder = [];
  while (true) {
    i++;
    let ranOne = false;
    for (const node in tree) {
      const {parents, children} = tree[node];
      if (children.length === 0) {
        done[node] = true;
      }
      if (done[node]) {
        runOrder.push(node);
        delete tree[node];
        ranOne = true;
      }
      for (const parent of parents) {
        if (tree[parent]) {
          const children = tree[parent].children;
          const newChildren = [];
          for (const child of children) {
            if (!done[child]) {
              newChildren.push(child);
            }
          }
          tree[parent].children = newChildren;
        }
      }
    }
    if (!ranOne) {
      return {runOrder, tree};
    }
  }
}
