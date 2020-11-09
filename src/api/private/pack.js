import { moveFile } from '@carbon/node-util';
const path = require('path');
import { yarn } from '../../util';
import generateTarballName from './generateTarballName';

/**
 * Packs the specified project into a tarball at the tarball path.
 * @param {*} project - Dependency project object.
 * @param {String} tarballDir - Directory to place the new 
 * @returns {String} - Absolute path of the generated tarball.
 */
export default async function pack(project, tarballDir) {
  // DO NOT TRY TO YARN PACK AT DIRECTORY. DRAGONS DOWN THAT PATH -JS
  const projectDir = project.local_path;
  await yarn('pack', projectDir);
  const filename = await generateTarballName(projectDir);
  const generatedTarball = path.join(projectDir, filename);
  const finalTarball = path.join(tarballDir, filename);
  await moveFile(generatedTarball, finalTarball);
  return finalTarball;
}