import path from "path";

const DEFAULT = "./.poly/dependencies";

export default function getDependenciesDir(projectDir) {
  const depDir = path.resolve(projectDir, DEFAULT);
  return depDir;
}
