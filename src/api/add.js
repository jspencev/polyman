import addRemove from './private/addRemove';

export default async function add(dependencies, dev = false, cwd) {
  await addRemove(dependencies, dev, 'add', cwd);

}