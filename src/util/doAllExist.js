import isOneOf from './isOneOf';

/**
 * Determines whether all submitted arguments exist (not null or undefined).
 * @param  {...any} args - Arguments to check.
 * @returns {Boolean} - Whether all args exist.
 */
export default function doAllExist(...args) {
  for (const arg of args) {
    if (isOneOf(arg, null, undefined)) {
      return false;
    }
  }
  return true;
}