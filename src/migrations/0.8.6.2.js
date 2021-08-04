import { findRepository } from "@jspencev/polyman-util";
import { writeJSONToFile } from "@jspencev/node-util";

export async function repoUp(repoDir) {
  const { repo, repoPath } = await findRepository(repoDir);
  for (const projectName in repo.projects) {
    repo.projects[projectName].name = projectName;
  }

  await writeJSONToFile(repoPath, repo);

  return true;
}

export async function repoDown(repoDir) {
  const { repo, repoPath } = await findRepository(repoDir);
  for (const projectName in repo.projects) {
    delete repo.projects[projectName].name;
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
