import { findRepository, writeJSONToFile } from '%/util';

export async function repoUp(repoDir) {
  const {repo, repoPath} = await findRepository(repoDir);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    project.dir_hash = project.hash;
    project.tarball_hash = 'tarball hash';
    delete project.hash;
    repo.projects[projectName] = project;
  }

  await writeJSONToFile(repoPath, repo);

  return true;
}

export async function repoDown(repoDir) {
  const {repo, repoPath} = await findRepository(repoDir);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    project.hash = project.dir_hash;
    delete project.dir_hash;
    delete project.tarball_hash;
    repo.projects[projectName] = project;
  }

  await writeJSONToFile(repoPath, repo);

  return true;
}

export async function projectUp(projectDir) {
  return true;
}

export async function projectDown(projectDir) {
  return true;
}