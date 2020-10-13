import doesExist from './doesExist';

/**
 * Returns the first of the submitted argments that is not undefined or null, falling back to the value of the last argument.
 * If undefined or null is submitted for the last argument, it will be returned on fallback.
 * @param  {...any} args - Args
 * @returns {*} - The first argument that exists, falling back to the last argument.
 */
export default function fallback(...args) {
  for (let i = 0; i < args.length - 1; i++) {
    const arg = args[i];
    if (doesExist(arg)) {
      return arg;
    }
  }
  return args[args.length - 1];
}