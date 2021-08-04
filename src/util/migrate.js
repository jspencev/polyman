import { isSameRepo, getMigrations } from "%/util";
import { findRepository } from "@jspencev/polyman-util";
import {
  getAppRootPath,
  findPackage,
  writeJSONToFile,
  readJSONFile,
} from "@jspencev/node-util";
import path from "path";
import _ from "lodash";
import chalk from "chalk";
import compareVersions from "compare-versions";

export default async function migrate(config = {}, cwd) {
  const appRootPath = await getAppRootPath(cwd);
  const { sameRepo } = await isSameRepo(appRootPath);

  // get the versions of the repo and the locally downloaded projects
  let repoVersion;
  let projectVersions = {};
  if (sameRepo) {
    const { repo } = await findRepository(appRootPath);
    repoVersion = repo.version;
    for (const projectName in repo.projects) {
      const project = repo.projects[projectName];
      if (project.local_path) {
        const polyConfigFile = path.join(project.local_path, "config.poly");
        const polyConfig = await readJSONFile(polyConfigFile);
        projectVersions[projectName] = {
          version: polyConfig.version,
          file: polyConfigFile,
        };
      }
    }
  } else {
    const polyConfigFile = path.join(appRootPath, "config.poly");
    try {
      const polyConfig = await readJSONFile(polyConfigFile);
      const { pack } = await findPackage(appRootPath);
      projectVersions[pack.name] = {
        version: polyConfig.version,
        file: polyConfigFile,
      };
    } catch (e) {
      return;
    }
  }

  const versions = await getMigrations();
  const highestVersion = _.last(versions);
  const migrationsDir = path.resolve(__dirname, "../migrations");

  // if there is a repo version and the repo version is less than the highest version, migrate the repo
  // if config.down is passed, allow migrations to run
  if (
    repoVersion &&
    (compareVersions(repoVersion, highestVersion) === -1 || config.down)
  ) {
    let { versionsToMigrate, finalVersion } = getMigrationsToRun(
      versions,
      repoVersion,
      config.down
    );
    if (versionsToMigrate.length > 0) {
      let { repo, repoPath } = await findRepository(appRootPath);
      const repoDir = path.parse(repoPath).dir;
      let completed;
      for (const version of versionsToMigrate) {
        const file = path.join(migrationsDir, `${version}.js`);
        const migration = await import(file);
        let success;
        if (config.down) {
          completed = version;
          success = await migration.repoDown(repoDir);
        } else {
          success = await migration.repoUp(repoDir);
          if (success) {
            completed = version;
          }
        }

        if (!success) {
          finalVersion = completed;
          break;
        }
      }

      ({ repo } = await findRepository(appRootPath));
      repo.version = finalVersion;
      await writeJSONToFile(repoPath, repo);

      console.log(
        chalk.magenta(
          `Migrated repository from v${repoVersion} to v${finalVersion}`
        )
      );
    }
  }

  // run all available project migrations
  for (const projectName in projectVersions) {
    const project = projectVersions[projectName];
    if (
      compareVersions(project.version, highestVersion) === -1 ||
      config.down
    ) {
      const projectDir = path.parse(project.file).dir;
      let { versionsToMigrate, finalVersion } = getMigrationsToRun(
        versions,
        project.version,
        config.down
      );
      if (versionsToMigrate.length > 0) {
        let completed;
        for (const version of versionsToMigrate) {
          const file = path.join(migrationsDir, `${version}.js`);
          const migration = await import(file);
          let success;
          if (config.down) {
            completed = version;
            success = await migration.projectDown(projectDir);
          } else {
            success = await migration.projectUp(projectDir);
            if (success) {
              completed = version;
            }
          }

          if (!success) {
            finalVersion = completed;
            break;
          }
        }

        const polyConfig = await readJSONFile(project.file);
        polyConfig.version = finalVersion;
        await writeJSONToFile(project.file, polyConfig);

        console.log(
          chalk.magenta(
            `Migrated ${projectName} from v${project.version} to v${finalVersion}`
          )
        );
      }
    }
  }
}

function getMigrationsToRun(versions, currentVersion, down) {
  const splitIndex = versions.indexOf(currentVersion);
  let versionsToMigrate;
  let finalVersion;
  if (down) {
    const startIndex = versions.indexOf(down);
    versionsToMigrate = versions.slice(startIndex + 1, splitIndex + 1);
    versionsToMigrate.reverse();
    finalVersion = down;
  } else {
    versionsToMigrate = versions.slice(splitIndex + 1);
    finalVersion = _.last(versionsToMigrate);
  }

  return { versionsToMigrate, finalVersion };
}
