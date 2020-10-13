import { init } from './api';
import { yarn } from './util';
const inquirer = require('inquirer');

function cli() {
  const argv = require('yargs')
    .command('init', 'Init a project in this directory')
    .demandCommand()
    .help()
    .argv;
  
  // const command
  const command = argv._[0];
  if (command === 'init') {
    (async function() {
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
      console.log('== DONE ==');
    })();
  } else {
    yarn(argv._);
  }
}

module.exports = cli;