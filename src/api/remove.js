import addRemove from './private/addRemove';

export default async function remove(dependencies) {
  await addRemove(dependencies, null, 'remove');
}