import { doAllExist, areAllTruthy } from '@jspencev/util';

export default function isRepoProject(projectName, repo) {
  if (projectName.charAt(0) === '@') {
    const split = projectName.split('@')[1].split('/');
    return areAllTruthy(split[0] === repo.name, isRepoProject(split[1], repo));
  }
  return doAllExist(repo.projects[projectName]);
}