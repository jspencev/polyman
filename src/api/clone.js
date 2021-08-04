import { findRepository } from "@jspencev/polyman-util";
import { spawnChildProcess, writeFileIfNotExist } from "@jspencev/node-util";
import path from "path";

export default async function clone(dependencies, config, cwd) {
  const { repo, repoPath } = await findRepository(cwd);
  for (const projectName of dependencies) {
    const project = repo.projects[projectName];
    if (!project) {
      throw Error(`Project "${projectName}" is not a part of this repository.`);
    }

    if (!project.git_repository) {
      throw Error(`Project "${projectName}" does not have a git repository.`);
    }

    if (project.local_path) {
      console.log(
        `Skipping project "${projectName}": Project is already cloned`
      );
    } else {
      const repoRootDir = path.parse(repoPath).dir;
      await spawnChildProcess("git", ["clone", project.git_repository], {
        cwd: repoRootDir,
      });
      const projectPath = path.join(repoRootDir, projectName);
      project.local_path = projectPath;
      repo.projects[projectName] = project;
    }
  }

  await writeFileIfNotExist(repoPath, JSON.stringify(repo, null, 2));
}
