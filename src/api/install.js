import { yarn } from "%/util";
import { relink } from "%/api";

export default async function install(config, cwd) {
  const yarnCmd = ["install"];
  if (config.production) {
    yarnCmd.push("--production");
  }
  await yarn(yarnCmd, cwd);

  config.install = true;
  config.force = true;
  await relink(config, cwd);
}
