import { moveFile } from '@jspencev/node-util';
import path from 'path';
import { yarn, getTarballFilename, getBuiltTarballDir } from '%/util';
import chalk from 'chalk';

/**
 * Packs the specified project into a tarball at the tarball path.
 * @param {*|String} project - Project object or the project directory.
 * @param {String} tarballDir - Directory to place the generated tarball.
 * @returns {String} - Absolute path of the generated tarball.
 */
export default async function pack(project, tarballDir) {
  // DO NOT TRY TO YARN PACK AT DIRECTORY. DRAGONS DOWN THAT PATH -JS
  let projectDir;
  if (typeof project === 'string') {
    projectDir = project;
  } else {
    projectDir = project.local_path;
  }

  if (!tarballDir) {
    tarballDir = await getBuiltTarballDir(projectDir);
  }

  await yarn('pack', projectDir);
  
  const filename = await getTarballFilename(projectDir);
  const generatedTarball = path.join(projectDir, filename);
  const finalTarball = path.join(tarballDir, filename);
  await moveFile(generatedTarball, finalTarball);
  console.log(chalk.green(`moved tarball to "${finalTarball}"`));
  return finalTarball;
}