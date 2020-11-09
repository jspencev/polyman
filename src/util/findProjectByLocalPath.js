export default function findProjectByLocalPath(repo, localPath) {
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    if (project.local_path === localPath) {
      return {projectName, project};
    }
  }
  return false;
}