export default function descopify(scopedName) {
  const split = scopedName.split('@')[1].split('/');
  return split[1];
}