/**
 * Converts a project name to a scoped dependency name.
 * @param {String} projectName - The name of the project. 
 * @param {*} repo - The repository object.
 */
export default function scopify(projectName, repo) {
  return `@${repo.name}/${projectName}`;
}