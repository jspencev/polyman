const path = require('path');

export default function getLocalTarballPath(project, repo, repoPath) {
  const prodTarball = repo.projects[project].tarball;
  const filename = path.parse(prodTarball).base;
  const repoDir = path.parse(repoPath).dir;
  const p = path.join(repoDir, '.poly', 'build', filename);
  return p;
}