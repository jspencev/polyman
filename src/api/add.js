import addRemove from './private/addRemove';

export default async function add(dependencies, dev = false) {
  await addRemove(dependencies, dev, 'add');
}