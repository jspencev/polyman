import { findRepository, writeJSONToFile, getMigrations } from '%/util';
import thenifyAll from 'thenify-all';
import path from 'path';
import _ from 'lodash';
import chalk from 'chalk';
import _fs from 'fs';
const fs = thenifyAll(_fs);

export default async function migrate(config = {}, cwd) {
  // grab the current version from the repository
  let {repo, repoPath} = await findRepository(cwd);
  const currentVersion = repo.version;

  // find all migrations that are higher than the current version
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = await getMigrations();
  const versionsToMigrate = [];
  for (const file of files) {
    const version = path.parse(file).name;
    if (config.down) {
      if (version <= currentVersion && version > config.down) {
        versionsToMigrate.push(version);
      }
    } else {
      if (version > currentVersion) {
        versionsToMigrate.push(version);
      }
    }
  }
  let finalVersion;
  versionsToMigrate.sort();
  if (config.down) {
    versionsToMigrate.reverse();
    finalVersion = config.down;
  } else {
    finalVersion = _.last(versionsToMigrate);
  }

  // execute the migrations
  if (versionsToMigrate.length > 0) {
    console.log(chalk.magenta(`Migrating your polyrepo from v${currentVersion} to v${finalVersion}`));
    for (const version of versionsToMigrate) {
      const file = path.join(migrationsDir, `${version}.js`);
      const migration = await import(file);
      if (config.down) {
        await migration.down(cwd);
      } else {
        await migration.up(cwd);
      }
    }
  
    // update the versions in repository.poly and in each config.poly
    ({repo} = await findRepository(cwd));
    repo.version = finalVersion
    await writeJSONToFile(repoPath, repo);
  
    for (const projectName in repo.projects) {
      const project = repo.projects[projectName];
      if (project.local_path) {
        const polyConfigFile = path.join(project.local_path, 'config.poly');
        try {
          const polyConfig = JSON.parse((await fs.readFile(polyConfigFile)).toString());
          polyConfig.version = repo.version;
          await writeJSONToFile(polyConfigFile, polyConfig);
        } catch(e) {}
      }
    }
  }
}