# Polyman
## Run a polyrepo like a monorepo

## WARNING
This is an early proof of concept with BASIC functionality. Do not use this package except to play around.

## Install
**Polyman depends on yarn.** If yarn is not installed: ```npm install -g yarn```
```
yarn global add polyman
```

## Description
Polyman is a polyrepo dependency management system that allows you to use multiple git repositories instead of combining all packages into a monorepo.

### Why?
Monorepos are dumb. Git is not designed to share build, test, and deploy across multiple semi-independent packages atomically. Hacks exist to stop git from running tests that are unneccessary, to only clone parts of the monorepo, etc.
However, polyrepos can be unwieldy. Code is spread across multiple systems, linking between packages during local development is a nightmare, there's no "source of truth" that knows which packages are part of an organization/project and which are not. Where polyrepos excel: atomiticity and efficient deploy.
Polyman is the best of both worlds, allowing git's design to handle deployment independently while managing local linking.

## Setup
Create a directory you want to use as the root of your polyrepo.
```
mkdir my-polyrepo
```
Create a file ```repository.poly``` and add the following:
```
{
  "name": "my-polyrepo",
  "projects": {}
}
```

## Usage
### Init a new polyman project
```poly init``` creates a new polyman project in the given directory.
```
mkdir my-project
cd my-project
poly init
```
Polyman will prompt choices about project setup. For now, polyman only supports Javascript projects.

Note: Polyman automatically inits a git repository and adds dependencies to enforce [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). TODO: Options around this.

### poly add [dependency(ies)...]
Adds dependencies to the current project. Package.json updates and repository.poly updates.

### poly local [add/remove] [dependency(ies)...]
Adds a project in this polyrepo as a dependency of the current project. If the project being added is locally available, it will be added as a file: dependency. Yarn symlinks. If the project is not locally available, polyman will fallback to the git_repository url (TODO: this doesn't work yet). Dependency will be add as @<my repository name>/<project>.

### poly remove [dependency(ies)...]
Removes dependencies. Works with both local and regular dependencies.

### poly bootstrap
Runs through every local polyman project and relinks all local project dependencies. TODO: optimize.

### poly ...ANYTHING ELSE...
All other commands are passed straight through to yarn.
