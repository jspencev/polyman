/**
 * Extracts the package name from a scoped name
 * @param {String} scopedName - Scoped dependency i.e. @foo/bar
 * @returns {String} - Package name.
 */
export default function descopify(scopedName) {
  let descoped;
  if (scopedName.charAt(0) === "@") {
    const split = scopedName.split("@")[1].split("/");
    descoped = split[1];
  } else {
    descoped = scopedName;
  }
  return descoped;
}
