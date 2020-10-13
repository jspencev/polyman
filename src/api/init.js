import { yarn } from '../util';
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { spawnChildProcess, findRepository, findPackage, sortObject } from '../util';
import add from './add';
const path = require('path');

export default async function init(prompt, git, nvmVersion, dotenv, envrc) {
  if (prompt) {
    await yarn('init');
  } else {
    await yarn('init -y');
  }

  const {repo, repoPath} = await findRepository();
  const {pack, packPath} = await findPackage();
  if (!repo.projects) {
    repo.projects = {};
  }
  if (repo.projects[pack.name]) {
    await fs.unlink(packPath);
    throw Error(`Cannot init project "${pack.name}", project already exists.`);
  }
  const projectDirs = packPath.split('/');
  projectDirs.pop();
  const projectPath = path.join(...projectDirs);
  let gitRepo = false;
  if (pack.repository && pack.repository.url) {
    gitRepo = pack.repository.url;
  }
  repo.projects[pack.name] = {
    language: 'javascript',
    local_path: projectPath,
    git_repository: gitRepo,
    dependencies: {},
    local_dependencies: {},
    local_dev_dependencies: {}
  };
  repo.projects = sortObject(repo.projects);
  await fs.writeFile(repoPath, JSON.stringify(repo, null, 2));
  
  if (git) {
    await spawnChildProcess('git', ['init']);
    await spawnChildProcess('git', ['add', '.']);
    await spawnChildProcess('git', ['commit', '-m', 'Initial commit']);

    let gitignore = '/node_modules\n/yarn-error.log\n';
    if (dotenv) {
      gitignore += '/.env\n'
    }
    await fs.writeFile('./.gitignore', gitignore);

    await add(['@commitlint/cli', '@commitlint/config-conventional', 'cz-conventional-changelog', 'git-cz', 'husky'], true);
    const pack = JSON.parse(await fs.readFile('./package.json'));
    pack.scripts = {
      commit: 'git-cz'
    };
    pack.config = {
      commitizen: {
        path: './node_modules/cz-conventional-changelog'
      }
    };
    pack.husky = {
      hooks: {
        "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
      }
    };
    await fs.writeFile('./package.json', JSON.stringify(pack, null, 2));

    const commitlint = `module.exports = {extends: ['@commitlint/config-conventional']}\n`;
    await fs.writeFile('./commitlint.config.js', commitlint);
  }

  if (nvmVersion) {
    const data = `${nvmVersion}\n`;
    await fs.writeFile('./.nvmrc', data);
  }

  if (dotenv) {
    const data = `NODE_ENV="development"\n`;
    await fs.writeFile('./.env', data);
  }

  if (envrc) {
    let code = ``;
    if (dotenv) {
      code += 'dotenv\n';
    }
    if (nvmVersion) {
      code += 'type nvm >/dev/null 2>&1 || . ~/.nvm/nvm.sh\nnvm install\n';
    }
    await fs.writeFile('./.envrc', code);
    await spawnChildProcess('direnv', ['allow']);
  }
}