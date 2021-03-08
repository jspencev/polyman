import addRemove from './private/addRemove';

export default async function add(dependencies, config, cwd) {
  const {repo, pack} = await addRemove(dependencies, 'add', config, cwd);
  return {repo, pack};
}