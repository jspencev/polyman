import { deleteFromYarnCache, yarn, findRepository, cleanYarnLock } from './src/util';

(async function() {
  const {repo} = await findRepository(__dirname);
  await cleanYarnLock(process.env.YARN_GLOBAL_DIR, repo);
  await deleteFromYarnCache('polyman');

  try {
    await yarn('global remove polyman');
  } catch (e) {}

  await cleanYarnLock(process.env.YARN_GLOBAL_DIR, repo);
  await deleteFromYarnCache('polyman');

  const tarballPath = repo.projects.polyman.tarball;
  if (tarballPath) {
    await yarn(`global add file:${tarballPath}`);
  } else {
    throw Error(`Repo doesn't have "tarball" key for project "polyman"`);
  }

  await cleanYarnLock(process.env.YARN_GLOBAL_DIR, repo);
  await deleteFromYarnCache('polyman');
})();
