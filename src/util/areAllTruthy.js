/**
 * Determines if all args submitted are truthy
 * @param  {...any} args - Args to check.
 * @returns {Boolean} - Whether all the args are truthy.
 */
export default function areAllTruthy(...args) {
  for (const arg of args) {
    if (!arg) {
      return false;
    }
  }
  return true;
}