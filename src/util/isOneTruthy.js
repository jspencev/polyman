/**
 * Determines if the arg(s) is truthy. Checked with "or"
 * @param  {...any} args - Args to check for truthyness
 * @returns {Boolean} - If one of the args is truthy
 */
export default function isOneTruthy(...args) {
  for (const arg of args) {
    if (arg) {
      return true;
    }
  }
  return false;
}