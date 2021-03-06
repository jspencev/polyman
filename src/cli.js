import { init, add, local, remove, bootstrap, build, clone, install, relink, initRepo } from '%/api';
import { yarn, migrate } from '%/util';
import { getAppRootPath, launchBabelDebug, readJSONFile } from '@jspencev/node-util';
import { isOneOf, fallback, isOneTruthy } from '@jspencev/util';
import inquirer from 'inquirer'
import path from 'path';
import _ from 'lodash';

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
  build: {
    type: 'boolean',
    description: 'Add local project as a build dependency.'
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
  inspect: {
    type: 'boolean',
    alias: 'debug',
    description: 'Pass inspect to the node process'
  },
  "inspect-brk": {
    type: 'boolean',
    alias: 'debug-brk',
    description: 'Pass inspect-brk to the node process'
  },
  noMigrate: {
    type: 'boolean',
    description: 'Do not run repository migrations'
  },
  optional: {
    type: 'boolean',
    description: 'Add as optional dependency'
  },
  peer: {
    type: 'boolean',
    description: 'Add as peer dependency'
  },
  production: {
    type: 'boolean',
    description: 'Install for production'
  },
  repo: {
    type: 'boolean',
    description: 'Init a repo'
  },
  tilde: {
    type: 'boolean',
    description: 'Installs most recent release of a package with the same minor version'
  }
};

export default async function cli(exec = false) {
  let yargs = require('yargs')
    .command('init', 'Init a project in this directory')
    .command('install', 'Install a project')
    .command('add <dependency...>', 'Add dependency(ies) to your project', function(yargs) {
      yargs.positional('dependency', {
        description: 'Dependency to add'
      })
    })
    .command('local <cmd> <dependency...>', 'Add project(s) in this polyrepo as a dependency', function(yargs) {
      yargs.positional('cmd', {
        description: 'Action to take. "add" or "remove"'
      })
      yargs.positional('dependency', {
        description: 'Project to add as dependency'
      })
    })
    .command('remove <dependency...>', 'Remove dependency(ies) to your project', function(yargs) {
      yargs.positional('dependency', {
        description: 'Project to add as dependency'
      })
    })
    .command('bootstrap', 'Relink dependencies. --all relinks every project.')
    .command('build', 'Build the current project. --force forces a rebuild.')
    .command('relink', `Uninstalls and reinstalls all local dependencies.`)
    .command('clone <dependency...>', 'Clones a non-local project.', function(yargs) {
      yargs.positional('dependency', {
        description: 'Project to add as dependency'
      })
    })
    .command('node <command...>', 'Execute the node process. If --babel, executes with babel-node');

  const defaultConfig = {};
  for (const option in OPTIONS) {
    const details = OPTIONS[option];
    yargs = yargs.option(option, details);
    defaultConfig[option] = false;
  }
  yargs = yargs.demandCommand()
    .help();
  const argv = yargs.argv;

  if (exec) {
    await yarn(['exec'].concat(argv._));
    return;
  }

  let fileConfig;
  let appRootPath;
  try {
    appRootPath = await getAppRootPath();
  } catch (e) {
    // not in a package
  }
  try {
    const configPath = path.join(appRootPath, 'config.poly');
    fileConfig = await readJSONFile(configPath);
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

  const command = argv._[0];


  // attempt to migrate the polyrepo to the most up-to-date version
  if (command !== 'node' && !config.noMigrate) {
    try {
      await migrate();
    } catch (e) {}
  }

  if (command === 'init') {
    if (config.repo) {
      const cwd = process.cwd();
      const guessName = _.last(cwd.split(path.sep));
      const questions = [{
        type: 'input',
        name: 'name',
        message: 'Name:',
        default: guessName
      }];
      const answers = await inquirer.prompt(questions);
      await initRepo(answers.name, cwd);
    } else {
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
    }
  } else if (command === 'install') {
    await install(config);
  } else if (command === 'add') {
    await add(argv.dependency, config);
  } else if (command === 'local') {
    await local(argv.dependency, argv.cmd, config);
  } else if (command === 'remove') {
    await remove(argv.dependency, config);
  } else if (command === 'bootstrap') {
    await bootstrap(config);
  } else if (command === 'build') {
    await build(config);
  } else if (command === 'relink') {
    await relink(config);
  } else if (command === 'clone') {
    await clone(argv.dependency, config);
  } else if (command === 'node') {
    let cmd = 'node';
    if (config.babel) {
      cmd = 'babel-node';
      console.log('executing with babel-node');
    }
    let args = process.argv.splice(3, process.argv.length);
    let newArgs = [];
    for (const arg of args) {
      if (!isOneOf(arg, '--inspect-brk', '--inspect', '--debug', '--debug-brk')) {
        newArgs.push(arg);
      }
    }
    args = newArgs;
    if (config.babel && isOneTruthy(argv.inspect, argv.inspectBrk)) {
      let fileToRun = args.shift();
      fileToRun = path.join(process.cwd(), fileToRun);
      const tmpFilePath = path.join(fallback(appRootPath, process.cwd()), './.poly/tmp');
      const brk = argv.inspectBrk;
      await launchBabelDebug(fileToRun, tmpFilePath, brk);
    } else {
      if (argv.inspect) {
        args.unshift('--inspect');
      } else if (argv.inspectBrk) {
        args.unshift('--inspect-brk');
      }
      args = ['exec', cmd].concat(args);
      await yarn(args);
    }
  } else {
    await yarn(argv._);
  }

  console.log('== DONE ==');
}