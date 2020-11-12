import { writeFileIfNotExist } from '@carbon/node-util';

/**
 * Writes an object to a file as JSON.
 * @param {String} file - Path to the file to write.
 * @param {*} obj - Object to write to file.
 * @param {Boolean} minify - Should minify the JSON? Default: false.
 */
export default async function writeJSONToFile(file, obj, minify = false) {
  let data;
  if (minify) {
    data = JSON.stringify(obj);
  } else {
    data = JSON.stringify(obj, null, 2);
  }
  await writeFileIfNotExist(file, data);
}