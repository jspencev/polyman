import isOneOf from './isOneOf';

/**
 * Determines whether one of the submitted arguments exists (not null or undefined).
 * @param  {...any} args - Args to check
 * @returns {Boolean} - Whether one of the arguments exists
 */
export default function doesOneExist(...args) {
  for (const arg of args) {
    if (!isOneOf(arg, null, undefined)) {
      return true;
    }
  }
  return false;
}