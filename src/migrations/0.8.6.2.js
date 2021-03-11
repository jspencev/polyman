import { findRepository, writeJSONToFile } from '%/util';

export async function up(cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  for (const projectName in repo.projects) {
    repo.projects[projectName].name = projectName;
  }

  await writeJSONToFile(repoPath, repo);
}

export async function down(cwd) {
  const {repo, repoPath} = await findRepository(cwd);
  for (const projectName in repo.projects) {
    delete repo.projects[projectName].name;
  }

  await writeJSONToFile(repoPath, repo);
}