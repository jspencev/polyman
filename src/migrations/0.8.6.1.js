import { findRepository, writeJSONToFile, readJSONFile } from '%/util';
import { sortObject } from '@jspencev/util';
import path from 'path';

export async function up(cwd) {
  const {repo} = await findRepository(cwd);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      const polyConfigFile = path.join(project.local_path, 'config.poly');
      let polyConfig;
      try {
        polyConfig = await readJSONFile(polyConfigFile);
      } catch (e) {
        polyConfig = {
          babel: false
        };
      }
      polyConfig.version = 'foo';
      polyConfig.repository_name = repo.name;
      polyConfig = sortObject(polyConfig);
      await writeJSONToFile(polyConfigFile, polyConfig);
    }
  }
}

export async function down(cwd) {
  const {repo} = await findRepository(cwd);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      const polyConfigFile = path.join(project.local_path, 'config.poly');
      const polyConfig = await readJSONFile(polyConfigFile);
      delete polyConfig.version;
      delete polyConfig.repository_name;
      await writeJSONToFile(polyConfigFile, polyConfig);
    }
  }
}