import { init, add, local, remove, bootstrap, build } from './api';
import { yarn, findPackage } from './util';
const inquirer = require('inquirer');
const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));
const path = require('path');
const _ = require('lodash');

const OPTIONS = {
  all: {
    alias: 'a',
    type: 'boolean',
    description: 'All projects'
  },
  babel: {
    type: 'boolean',
    description: 'Execute with node-babel'
  },
  dev: {
    alias: 'd',
    type: 'boolean',
    description: 'Add as dev dependency'
  },
  exact: {
    type: 'boolean',
    description: 'Add the exact version of a package'
  },
  force: {
    alias: 'f',
    type: 'boolean',
    description: 'Force'
  },
  optional: {
    type: 'boolean',
    description: 'Add as optional dependency'
  },
  pack: {
    alias: 'p',
    type: 'boolean',
    description: 'Pack into tarball before locally adding.'
  },
  peer: {
    type: 'boolean',
    description: 'Add as peer dependency'
  },
  tilde: {
    type: 'boolean',
    description: 'Installs most recent release of a package with the same minor version'
  }
};

async function cli() {
  let yargs = require('yargs')
    .command('init', 'Init a project in this directory')
    .command('add [dependency...]', 'Add dependency(ies) to your project', function(yargs) {
      yargs.positional('dependency', {
        description: 'Dependency to add'
      })
    })
    .command('local [cmd] [dependency...]', 'Add project(s) in this polyrepo as a dependency', function(yargs) {
      yargs.positional('cmd', {
        description: 'Action to take. "add" or "remove"'
      })
      yargs.positional('dependency', {
        description: 'Project to add as dependency'
      })
    })
    .command('remove [dependency...]', 'Remove dependency(ies) to your project', function(yargs) {
      yargs.positional('dependency', {
        description: 'Project to add as dependency'
      })
    })
    .command('bootstrap', 'Relink dependencies. --all relinks every project.')
    .command('build', 'Build the current project. --force forces a rebuild.')
    .command('node [command...]', 'Execute the node process. If --babel, executes with babel-node');

  const defaultConfig = {};
  for (const option in OPTIONS) {
    const details = OPTIONS[option];
    yargs = yargs.option(option, details);
    defaultConfig[option] = false;
  }
  yargs = yargs.demandCommand()
    .help();
  const argv = yargs.argv;

  let fileConfig;
  try {
    const {packPath} = await findPackage();
    const configPath = path.join(path.parse(packPath).dir, 'config.poly');
    fileConfig = JSON.parse(await fs.readFile(configPath));
  } catch(e) {
    // not found
    fileConfig = {};
  }

  const argvConfig = {};
  for (const option in OPTIONS) {
    if (argv[option]) {
      argvConfig[option] = argv[option];
    }
  }

  const config = _.merge({}, defaultConfig, fileConfig, argvConfig);

  // const command
  const command = argv._[0];
  if (command === 'init') {
    let questions = [{
      type: 'confirm',
      name: 'nvm',
      message: 'Would you like to create .nvmrc?',
      default: true
    }];
    const {nvm} = await inquirer.prompt(questions);
    let nvmVersion;
    if (nvm) {
      questions = [{
        type: 'input',
        name: 'nvmVersion',
        message: 'Which version of node would you like to use?',
        default: 'latest'
      }];
      ({nvmVersion} = await inquirer.prompt(questions));
      if (nvmVersion === 'latest') {
        nvmVersion = 'node';
      }
    }

    questions = [{
      type: 'confirm',
      name: 'dotenv',
      message: 'Would you like to create .env with NODE_ENV=development?',
      default: true
    }];
    const {dotenv} = await inquirer.prompt(questions);

    let envrc = false;
    if (nvm || dotenv) {
      questions = [{
        type: 'confirm',
        name: 'envrc',
        message: 'Would you like to create .envrc?',
        default: true
      }];
      ({envrc} = await inquirer.prompt(questions));
    }

    await init(true, true, nvmVersion, dotenv, envrc);
  } else if (command === 'add') {
    await add(argv.dependency, config);
  } else if (command === 'local') {
    await local(argv.dependency, argv.cmd, config);
  } else if (command === 'remove') {
    await remove(argv.dependency);
  } else if (command === 'bootstrap') {
    await bootstrap(config);
  } else if (command === 'build') {
    await build(config);
  } else if (command === 'node') {
    let cmd = 'node';
    if (config.babel) {
      cmd = 'babel-node';
      console.log('executing with babel-node');
    }
    let args = process.argv.splice(3, process.argv.length);
    args = ['exec', cmd].concat(args);
    await yarn(args);
  } else {
    await yarn(argv._);
  }

  console.log('== DONE ==');
}

module.exports = cli;