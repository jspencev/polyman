import { findRepository } from '../util';
import { findPackage, getAppRootPath } from '@carbon/node-util';
import add from './add';
import remove from './remove';
const thenify = require('thenify');
const glob = thenify(require('glob'));
const path = require('path');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));

export default async function local(projects, nextCdm, config, cwd) {
  const {repo} = await findRepository(cwd);
  const myPackage = await findPackage(cwd);
  const myName = myPackage.pack.name;
  const toStrip = [];
  for (const projectName of projects) {
    const project = repo.projects[projectName]
    if (!project) {
      throw Error( `Project "${projectName}" is not a project in this polyrepo`);
    }
  
    if (!project.local_path && !project.git_repository) {
      throw Error(`Project is not local and does not have a git repository. The project must have at least one.`);
    }
  
    if (!project.local_path) {
      throw Error('Cloning from git repository is not yet supported.');
    }

    if (project.npm && repo.projects[myName].dependencies[project.npm]) {
      toStrip.push(project.npm);
    }
  }

  if (toStrip.length > 0) {
    console.log(`Stripping ${toStrip.join(' ')}...`);
    try {
      await remove(toStrip, cwd);
    } catch (e) {}
  }

  const appRootPath = await getAppRootPath(cwd);
  const dependenciesDir = path.join(appRootPath, '.poly', 'dependencies');
  let deps = [];
  if (nextCdm === 'add') {
    for (const projectName of projects) {
      const project = repo.projects[projectName];
      const scopedName = `@${repo.name}/${projectName}`;
      if (project.tarball) {
        let depPath = path.join(dependenciesDir, path.parse(project.tarball).base);
        try {
          await fs.unlink(depPath);
        } catch (e) {}
        await fs.copyFile(project.tarball, depPath);
        depPath = path.relative(appRootPath, depPath);
        const dep = `${scopedName}@file:${depPath}`;
        deps.push(dep);
      } else {
        console.warn(`Project "${projectName}" does not have a tarball associated with it. You need to build the project with polyman and then call the add command again.`);
      }
    }
    if (deps.length > 0) {
      await add(deps, config, cwd);
    }
  } else if (nextCdm === 'remove') {
    let tarballsToRemove = [];
    for (const p of projects) {
      deps.push(`@${repo.name}/${p}`);
      const files = await glob(path.join(appRootPath, `./.poly/dependencies/${p}*`));
      tarballsToRemove = tarballsToRemove.concat(files);
    }
    await remove(deps, cwd);
    for (const tarballPath of tarballsToRemove) {
      await fs.unlink(tarballPath);
    }
  } else {
    throw Error('local command must be followed by either "add" or "remove"');
  }
}