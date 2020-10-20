/**
 * Checks if x is one of y. Strict equality.
 * @example
 * isOneOf('foo', 'bar', 'foo'); // true
 * isOneOf('foo', 'bar', null); // false
 * isOneOf(null, undefined, false); // false
 * @param {*} x - Reference item.
 * @param  {...any} y - Items to check against.
 * @returns {Boolean} - Is x one of y?
 */
export default function isOneOf(x, ...y) {
  for (const val of y) {
    if (x === val) {
      return true;
    }
  }
  return false;
}