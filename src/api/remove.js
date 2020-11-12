import addRemove from './private/addRemove';

export default async function remove(dependencies, config, cwd) {
  await addRemove(dependencies, 'remove', config, cwd);
}