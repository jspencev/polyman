import path from "path";
import { getMigrations } from "%/util";
import { findRepository } from "@jspencev/polyman-util";
import { writeJSONToFile } from "@jspencev/node-util";
import chalk from "chalk";
import _ from "lodash";

export default async function initRepo(name, cwd = process.cwd()) {
  let repo;
  try {
    ({ repo } = await findRepository(cwd));
  } catch (e) {}
  if (repo) {
    throw Error(
      `Cannot initialize a repository inside another repository. You're inside "${repo.name}"`
    );
  }

  const versions = await getMigrations();
  const version = _.last(versions);
  repo = {
    name: name,
    version: version,
    projects: {},
  };

  const repoFile = path.join(cwd, "repository.poly");
  await writeJSONToFile(repoFile, repo);
  console.log(chalk.magenta(`Initialized repository at ${repoFile}`));
}
