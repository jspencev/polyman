import addRemove from './private/addRemove';

export default async function add(dependencies, config, cwd) {
  await addRemove(dependencies, 'add', config, cwd);
}