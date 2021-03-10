import { findRepository, writeJSONToFile } from '%/util';
import { sortObject } from '@jspencev/util';
import thenifyAll from 'thenify-all';
import path from 'path';
import _fs from 'fs';
const fs = thenifyAll(_fs);

export async function up(cwd) {
  const {repo} = await findRepository(cwd);
  for (const projectName in repo.projects) {
    const project = repo.projects[projectName];
    if (project.local_path) {
      const polyConfigFile = path.join(project.local_path, 'config.poly');
      let polyConfig;
      try {
        polyConfig = JSON.parse((await fs.readFile(polyConfigFile)).toString());
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
      const polyConfig = JSON.parse((await fs.readFile(polyConfigFile)).toString());
      delete polyConfig.version;
      delete polyConfig.repository_name;
      await writeJSONToFile(polyConfigFile, polyConfig);
    }
  }
}