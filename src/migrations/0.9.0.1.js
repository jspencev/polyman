import { findRepository } from '%/util';
import { writeJSONToFile } from '@jspencev/node-util';

export async function repoUp(repoDir) {
  const {repo, repoPath} = await findRepository(repoDir);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    delete project.tarball_hash;
    repo.projects[projectName] = project;
  }

  await writeJSONToFile(repoPath, repo);

  return true;
}

export async function repoDown(repoDir) {
  const {repo, repoPath} = await findRepository(repoDir);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    project.tarball_hash = 'init';
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