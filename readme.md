# Polyman
## Run a polyrepo like a monorepo

## WARNING
This is an early proof of concept with BASIC functionality. Do not use this package except to play around.

## Install
**Polyman depends on yarn v1.x.** If yarn is not installed: ```npm install -g yarn```
```
yarn global add polyman
```

## Description
Polyman is a polyrepo dependency management system that allows you to use multiple git repositories instead of combining all packages into a monorepo.

### Why?
Monorepos are great in concept, but a hassle in practice. Git is not designed to share build, test, and deploy across multiple semi-independent packages atomically. Hacks exist to stop git from running tests that are unneccessary, to only clone parts of the monorepo, etc.

However, polyrepos can be unwieldy. Code is spread across multiple systems, linking between packages during local development is a nightmare, there's no "source of truth" that knows which packages are part of an organization/project and which are not. Where polyrepos excel: atomiticity and efficient deploy.

Polyman is the best of both worlds, allowing git's design to handle deployment independently while dependencies across repositories.

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

**Polyman is essentially a wrapper around yarn. Everytime you would call yarn, call poly**

### poly add [dependency(ies)...]
Adds dependencies to the current project.

### poly remove [dependency(ies)...]
Removes dependencies.

### poly local [add/remove] [dependency(ies)...]
Adds/removes a project in this polyrepo as a dependency of the current project. If the project is locally available, it will be added as a file: dependency and yarn will symlink. If the project is not locally available, polyman will fallback to the git_repository url (TODO: this doesn't work yet). Dependency added scoped as @<my repository name>/<project>.

## poly build (-f)
Calls the build command if the directory has new content and packs the project into a tarball at .poly/build/ --force will force a rebuild.

### poly bootstrap (-a) (-f)
Runs through every local polyman project and relinks all local project dependencies. --all will bootstrap all local projects. -f will force the builds and links to run.

### poly node [cmd...]
Executes node in the environment of your app. If config.poly includes "babel": true, the command will be executed with babel-node. This works for debuggind as well.

### poly ...ANYTHING ELSE...
All other commands are passed straight through to yarn.
