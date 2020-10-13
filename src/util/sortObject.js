export default function sortObject(obj) {
  const newObj = {};
  Object.keys(obj)
    .sort()
    .forEach(function(v) {
      newObj[v] = obj[v];
    });
  return newObj;
}