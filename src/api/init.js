import { yarn } from '../util';
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
import { spawnChildProcess } from '../util';

export default async function init(prompt, git, nvmVersion, dotenv, envrc) {
  if (prompt) {
    await yarn('init');
  } else {
    await yarn('init -y');
  }
  
  if (git) {
    await spawnChildProcess('git', ['init']);
    await spawnChildProcess('git', ['add', '.']);
    await spawnChildProcess('git', ['commit', '-m', 'Initial commit']);

    let gitignore = '/node_modules\n/yarn-error.log\n';
    if (dotenv) {
      gitignore += '/.env\n'
    }
    await fs.writeFile('./.gitignore', gitignore);

    await yarn('add --dev @commitlint/cli @commitlint/config-conventional cz-conventional-changelog git-cz husky');
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