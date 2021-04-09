import addRemove from './private/addRemove';

export default async function relink(config = {}, cwd) {
  config.local = true;
  return await addRemove([], 'add', config, cwd);
}