import inquirer from 'inquirer';
import { migrate, getMigrations } from '%/util';
import { findRepository } from '@jspencev/polyman-util'

(async function() {
  let questions = [{
    type: 'list',
    name: 'direction',
    message: "Up or down?",
    choices: ['up', 'down']
  }];

  let answers = await inquirer.prompt(questions);
  if (answers.direction === 'up') {
    await migrate();
  } else {
    const {repo} = await findRepository();
    const currentVersion = repo.version;
    const versions = await getMigrations();
    const splitIndex = versions.indexOf(currentVersion);
    const versionsToMigrate = versions.slice(0, splitIndex);
    versionsToMigrate.reverse();
    
    questions = [{
      type: 'list',
      name: 'finalVersion',
      message: 'What version do you want to rollback to?',
      choices: versionsToMigrate
    }];
    answers = await inquirer.prompt(questions);
    const config = {
      down: answers.finalVersion
    };
    await migrate(config);
  }
})();