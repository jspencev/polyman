import addRemove from './private/addRemove';

export default async function relink(config = {}, cwd) {
  config.local = true;
  await addRemove([], 'add', config, cwd);
}