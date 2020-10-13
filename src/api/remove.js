import addRemove from './private/addRemove';

export default async function remove(dependencies, cwd) {
  await addRemove(dependencies, null, 'remove', cwd);
}