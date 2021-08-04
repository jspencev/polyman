/**
 * Converts a project name to a scoped dependency name.
 * @param {String} projectName - The name of the project.
 * @param {*|String} repoName - The repository name or object.
 */
export default function scopify(projectName, repoName) {
  if (typeof repoName !== "string") {
    repoName = repoName.name;
  }
  const scopedName = `@${repoName}/${projectName}`;
  return scopedName;
}
