import addRemove from './private/addRemove';

export default async function remove(dependencies, config, cwd) {
  const {repo, pack} = await addRemove(dependencies, 'remove', config, cwd);
  return {repo, pack};
}