import thenify from 'thenify';
import _glob from 'glob';
const glob = thenify(_glob);
import path from 'path';


export default async function getMigrations() {
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = await glob(path.join(migrationsDir, '*'));
  return files;
}