/**
 * Checks whether the submitted item exists. Will only return false if the submitted item is null or undefined.
 * This function should ALWAYS be used when checking for existance before continuing.
 * Common mistakes like var foo = 0 will return false when you wanted true. This function prevents those mistakes.
 * @param {*} item 
 */
export default function doesExist(item) {
  return typeof item !== 'undefined' && item !== null;
}