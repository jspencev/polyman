import { deleteFromYarnCache, yarn, findRepository, cleanYarnLock } from './src/util';

(async function() {
  try {
    await yarn('global remove polyman');
  } catch (e) {}
  await deleteFromYarnCache('polyman');

  const {repo} = await findRepository(__dirname);
  const tarballPath = repo.projects.polyman.tarball;
  if (tarballPath) {
    await yarn(`global add file:${tarballPath}`);
  } else {
    throw Error(`Repo doesn't have "tarball" key for project "polyman"`);
  }

  await cleanYarnLock();
})();
