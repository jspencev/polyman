/**
 * Get all local projects connected via local dependency to the given project. Projects will only appear once in output.
 * @param {String} projectName - Name of the project to get connected projects for.
 * @param {*} repo - Repository object.
 * @param {Boolean} dev - Should include dev dependencies? Default: false.
 * @param {Boolean} passDev - Should include dev dependencies of found dependencies and devDependencies. Only works if dev = true. Default: false;
 * @param {Array<String>} connectedProjects - Initial connectedProjects. Pass [<PROJECT NAME>] to include your project in the array. It will remain the first element in the return. Default: [].
 * @returns {Array<String>} - Array of found dependencies. In found order, not tree order.
 */
export default function getConnectedProjects(projectName, repo, dev = false, passDev = false, connectedProjects = []) {
  const project = repo.projects[projectName];
  const deps = Object.keys(project.local_dependencies);
  let allDeps = deps;
  if (dev) {
    const devDeps = Object.keys(project.local_dev_dependencies);
    allDeps = deps.concat(devDeps);
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
