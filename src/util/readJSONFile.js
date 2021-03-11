import thenifyAll from 'thenify-all';
import _fs from 'fs';
const fs = thenifyAll(_fs);

/**
 * Reads a file to an object.
 * @param {String} file - Path to the file.
 * @returns {*} - Object in file as an object.
 */
export default async function readJSONFile(file) {
  const buf = await fs.readFile(file);
  try {
    const obj = JSON.parse(buf);
    return obj;
  } catch (e) {
    throw Error(`File contents could not be parsed as JSON. File: ${file}`);
  }
}