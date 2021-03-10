import inquirer from 'inquirer';
import { migrate, getMigrations, findRepository } from '%/util';
import path from 'path';

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
    const files = await getMigrations();
    const versionsToMigrate = [];
    for (const file of files) {
      const version = path.parse(file).name;
      if (version < currentVersion) {
        versionsToMigrate.push(version);
      }
    }
    versionsToMigrate.sort();
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