import thenifyAll from "thenify-all";
import _fs from "fs";
const fs = thenifyAll(_fs);
import { getMigrations, yarn } from "%/util";
import { findRepository } from "@jspencev/polyman-util";
import {
  findPackage,
  spawnChildProcess,
  writeJSONToFile,
  readJSONFile,
} from "@jspencev/node-util";
import { sortObject } from "@jspencev/util";
import add from "./add";
import path from "path";
import _ from "lodash";

export default async function init(
  prompt,
  git,
  nvmVersion,
  dotenv,
  envrc,
  cwd
) {
  if (prompt) {
    await yarn("init", cwd);
  } else {
    await yarn("init -y", cwd);
  }

  const { repo, repoPath } = await findRepository(cwd);
  const { pack, packPath } = await findPackage(cwd);
  if (!repo.projects) {
    repo.projects = {};
  }
  if (repo.projects[pack.name]) {
    await fs.unlink(packPath);
    throw Error(`Cannot init project "${pack.name}", project already exists.`);
  }
  const projectPath = path.join(packPath, "..");
  let gitRepo = false;
  if (pack.repository && pack.repository.url) {
    gitRepo = pack.repository.url;
  }
  repo.projects[pack.name] = {
    language: "javascript",
    local_path: projectPath,
    git_repository: gitRepo,
    dir_hash: "init",
    dependencies: {},
    dev_dependencies: {},
    local_dependencies: {},
    local_dev_dependencies: {},
    build_dependencies: [],
  };
  repo.projects = sortObject(repo.projects);
  await writeJSONToFile(repoPath, repo);

  const versions = await getMigrations();

  const polyConfigFile = path.join(projectPath, "config.poly");
  const defaultPolyConfig = {
    repository_name: repo.name,
    version: _.last(versions),
    babel: false,
  };
  await writeJSONToFile(polyConfigFile, defaultPolyConfig);

  if (git) {
    await spawnChildProcess("git", ["init"]);
    await spawnChildProcess("git", ["add", "."]);
    await spawnChildProcess("git", ["commit", "-m", "Initial commit"]);

    let gitignore = "/node_modules\n/yarn-error.log\n";
    if (dotenv) {
      gitignore += "/.env\n";
    }
    await fs.writeFile("./.gitignore", gitignore);

    await add(
      [
        "@commitlint/cli",
        "@commitlint/config-conventional",
        "cz-conventional-changelog",
        "git-cz",
        "husky",
        "commitizen",
      ],
      { dev: true }
    );
    const pack = await readJSONFile("./package.json");
    pack.scripts = {
      commit: "git-cz",
    };
    pack.config = {
      commitizen: {
        path: "./node_modules/cz-conventional-changelog",
      },
    };
    pack.husky = {
      hooks: {
        "commit-msg": "commitlint -E HUSKY_GIT_PARAMS",
      },
    };
    await fs.writeFile("./package.json", JSON.stringify(pack, null, 2));

    const commitlint = `module.exports = {extends: ['@commitlint/config-conventional']}\n`;
    await fs.writeFile("./commitlint.config.js", commitlint);
  }

  if (nvmVersion) {
    const data = `${nvmVersion}\n`;
    await fs.writeFile("./.nvmrc", data);
  }

  if (dotenv) {
    const data = `NODE_ENV="development"\n`;
    await fs.writeFile("./.env", data);
  }

  if (envrc) {
    let code = ``;
    if (dotenv) {
      code += "dotenv\n";
    }
    if (nvmVersion) {
      code += "type nvm >/dev/null 2>&1 || . ~/.nvm/nvm.sh\nnvm install\n";
    }
    await fs.writeFile("./.envrc", code);
    await spawnChildProcess("direnv", ["allow"]);
  }
}
