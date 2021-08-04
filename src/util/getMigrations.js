import thenify from "thenify";
import _glob from "glob";
const glob = thenify(_glob);
import path from "path";
import compareVersions from "compare-versions";

export default async function getMigrations() {
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const files = await glob(path.join(migrationsDir, "*"));
  const versions = [];
  for (const file of files) {
    const version = path.parse(file).name;
    versions.push(version);
  }
  versions.sort(compareVersions);
  return versions;
}
