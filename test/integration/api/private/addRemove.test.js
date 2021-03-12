import { expect, sinon, descriptions } from '@jspencev/test-util';
import addRemove, { __RewireAPI__ as Rewire } from '%/api/private/addRemove';
import _ from 'lodash';
import path from 'path';

const REPO_NAME = 'foo-repo';
const REPO_DIR = '/foo';
const REPO_PATH = path.join(REPO_DIR, 'repository.poly');
const PROJECT_NAME = 'local-bar';
const PROJECT_DIR = path.join(REPO_DIR, 'local-bar');
const PACK_PATH = path.join(PROJECT_DIR, 'package.json');

export default function() {
  describe(descriptions.exportFn('addRemove'), function() {
    let writeJSONToFile;
    let yarn;
    let addDependenciesToProject;
    let md5;
    let fs;
    beforeEach(async function() {
      writeJSONToFile = sinon.fake.resolves();
      Rewire.__Rewire__('writeJSONToFile', writeJSONToFile);

      yarn = sinon.fake.resolves();
      Rewire.__Rewire__('yarn', yarn);

      addDependenciesToProject = sinon.fake(Rewire.__GetDependency__('addDependenciesToProject'));
      Rewire.__Rewire__('addDependenciesToProject', addDependenciesToProject);

      md5 = sinon.fake.returns('good hash');
      Rewire.__Rewire__('md5', md5);

      fs = {
        readFile: sinon.fake.resolves()
      };
      Rewire.__Rewire__('fs', fs);
    });

    describe(descriptions.category('in repository'), function() {
      const localFooDir = path.join(REPO_DIR, 'local-foo');
      const localFooTarballPath = path.join(localFooDir, '.poly/build/local-foo-v1.0.0.tgz');
      const localBarTarballPath = path.join(PROJECT_DIR, '.poly/build/local-bar-v1.0.0.tgz');
      
      let initRepo;

      let findRepository;
      let isSameRepo;
      let findPackage;
      let isFile;
      let glob;
      beforeEach(async function() {
        initRepo = {
          name: REPO_NAME,
          projects: {
            "local-foo": {
              name: "local-foo",
              tarball: localFooTarballPath,
              local_path: localFooDir,
              dir_hash: 'good hash',
              tarball_hash: 'tarball_hash',
              dependencies: {},
              dev_dependencies: {},
              local_dependencies: {},
              local_dev_dependencies: {},
              build_dependencies: []
            },
            "local-bar": {
              name: "local-bar",
              tarball: localBarTarballPath,
              local_path: PROJECT_DIR,
              dir_hash: 'good hash',
              tarball_hash: 'tarball_hash',
              dependencies: {},
              dev_dependencies: {},
              local_dependencies: {},
              local_dev_dependencies: {},
              build_dependencies: []
            }
          }
        };

        isSameRepo = sinon.fake.resolves({
          sameRepo: true,
          repoName: REPO_NAME
        });
        Rewire.__Rewire__('isSameRepo', isSameRepo);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);
      });

      it('should add dependency', async function() {
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {
                  baz: '^1.0.0'
                },
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['baz'], 'add', {});

        expect(glob).to.not.be.called;
        expect(md5).to.not.be.called;
        expect(isFile).to.not.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.have.property('baz', '^1.0.0');
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.have.property('baz', '^1.0.0');
        expect(yarn).to.be.calledOnceWithExactly(['add', 'baz'], PROJECT_DIR);
      });

      it('should add a dev dependency', async function() {
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {
                  baz: '^1.0.0'
                },
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['baz'], 'add', {dev: true});

        expect(glob).to.not.be.called;
        expect(md5).to.not.be.called;
        expect(isFile).to.not.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dev_dependencies).to.have.property('baz', '^1.0.0');
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.devDependencies).to.have.property('baz', '^1.0.0');
        expect(yarn).to.be.calledOnceWithExactly(['add', '--dev', 'baz'], PROJECT_DIR);
      });

      it('should remove a dependency', async function() {
        initRepo.projects[PROJECT_NAME].dependencies = {
          baz: '^1.0.0'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {
                  baz: '^1.0.0'
                },
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['baz'], 'remove', {});

        expect(glob).to.not.be.called;
        expect(md5).to.not.be.called;
        expect(isFile).to.not.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.be.empty;
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.be.empty;
        expect(yarn).to.be.calledOnceWithExactly(['remove', 'baz'], PROJECT_DIR);
      });

      it('should not relink if the hash matches', async function() {
        initRepo.projects[PROJECT_NAME].local_dependencies = {
          'local-foo': 'good hash'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [
                  'local-foo'
                ],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [
                  'local-foo'
                ],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove([], 'add', {});

        expect(md5).to.be.calledOnce;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(_.isEqual(initRepo, repo));
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.be.empty;
        expect(pack.localDependencies).to.have.length(1);
        expect(yarn).to.not.be.called;
      });

      it('should relink if the hash does not match', async function() {
        initRepo.projects[PROJECT_NAME].local_dependencies = {
          'local-foo': 'bad hash'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [
                  'local-foo'
                ],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [
                  'local-foo'
                ],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove([], 'add', {});

        expect(md5).to.be.calledOnce;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].local_dependencies).to.have.property('local-foo', 'good hash');
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.be.empty;
        expect(pack.localDependencies).to.have.length(1);
        expect(yarn).to.be.calledTwice;
        expect(yarn).to.be.calledWithExactly(['remove', `@${REPO_NAME}/local-foo`], PROJECT_DIR);
        expect(yarn).to.be.calledWithExactly(['add', `@${REPO_NAME}/local-foo@file:${localFooTarballPath}`], PROJECT_DIR);
      });

      it('should abort if an existing tarball does not exist', async function() {
        initRepo.projects[PROJECT_NAME].local_dependencies = {
          'local-foo': 'good hash'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [
                  'local-foo'
                ],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {}
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(false);
        Rewire.__Rewire__('isFile', isFile);

        await expect(addRemove([], 'add', {})).to.eventually.be.rejected;

        expect(writeJSONToFile).to.not.be.called;
        expect(isFile).to.be.called;
      });

      it('should abort if a new tarball does not exist', async function() {
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {}
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(false);
        Rewire.__Rewire__('isFile', isFile);

        await expect(addRemove(['local-foo'], 'add', {local: true})).to.eventually.be.rejected;

        expect(writeJSONToFile).to.not.be.called;
        expect(isFile).to.be.called;
      });

      it('should add a local dependency', async function() {
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            const dependencies = {};
            dependencies[`@${REPO_NAME}/local-foo`] = `file:${localFooTarballPath}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['local-foo'], 'add', {local: true});

        expect(md5).to.not.be.called;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.be.empty;
        expect(repo.projects[PROJECT_NAME].local_dependencies).to.have.property('local-foo', 'good hash');
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).be.empty;
        expect(pack.localDependencies).to.have.length(1);
        expect(pack.localDevDependencies).to.have.length(0);
        expect(yarn).to.be.calledOnceWithExactly(['add', `@${REPO_NAME}/local-foo@file:${localFooTarballPath}`], PROJECT_DIR);
      });

      it('should add a local dev dependency', async function() {
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            const dependencies = {};
            dependencies[`@${REPO_NAME}/local-foo`] = `file:${localFooTarballPath}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['local-foo'], 'add', {local: true, dev: true});

        expect(md5).to.not.be.called;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.be.empty;
        expect(repo.projects[PROJECT_NAME].local_dev_dependencies).to.have.property('local-foo', 'good hash');
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).be.empty;
        expect(pack.localDependencies).to.have.length(0);
        expect(pack.localDevDependencies).to.have.length(1);
        expect(yarn).to.be.calledOnceWithExactly(['add', `@${REPO_NAME}/local-foo@file:${localFooTarballPath}`], PROJECT_DIR);
      });

      it('should remove a local dependency', async function() {
        initRepo.projects[PROJECT_NAME].local_dependencies = {
          'local-foo': 'good hash'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            const dependencies = {};
            dependencies[`@${REPO_NAME}/local-foo`] = `file:${localFooTarballPath}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: ['local-foo'],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['local-foo'], 'remove', {local: true});

        expect(md5).to.be.called;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.be.empty;
        expect(repo.projects[PROJECT_NAME].local_dev_dependencies).to.be.empty;
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).be.empty;
        expect(pack.localDependencies).to.have.length(0);
        expect(pack.localDevDependencies).to.have.length(0);
        expect(yarn).to.be.calledOnceWithExactly(['remove', `@${REPO_NAME}/local-foo`], PROJECT_DIR);
      });

      it('should remove a local dev dependency', async function() {
        initRepo.projects[PROJECT_NAME].local_dev_dependencies = {
          'local-foo': 'good hash'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            const devDependencies = {};
            devDependencies[`@${REPO_NAME}/local-foo`] = `file:${localFooTarballPath}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: devDependencies,
                localDependencies: [],
                localDevDependencies: ['local-foo']
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['local-foo'], 'remove', {local: true});

        expect(md5).to.be.called;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.be.empty;
        expect(repo.projects[PROJECT_NAME].local_dev_dependencies).to.be.empty;
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).be.empty;
        expect(pack.localDependencies).to.have.length(0);
        expect(pack.localDevDependencies).to.have.length(0);
        expect(yarn).to.be.calledOnceWithExactly(['remove', `@${REPO_NAME}/local-foo`], PROJECT_DIR);
      });

      it('should remove a local dependency even if the hash is bad', async function() {
        initRepo.projects[PROJECT_NAME].local_dependencies = {
          'local-foo': 'bad hash'
        };
        findRepository = sinon.fake.resolves({
          repo: initRepo,
          repoPath: REPO_PATH
        });
        Rewire.__Rewire__('findRepository', findRepository);

        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            const dependencies = {};
            dependencies[`@${REPO_NAME}/local-foo`] = `file:${localFooTarballPath}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: ['local-foo'],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);

        const {pack, repo} = await addRemove(['local-foo'], 'remove', {local: true});

        expect(md5).to.be.called;
        expect(isFile).to.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(REPO_PATH);
        expect(lastWriteArgs[1]).to.equal(repo);
        expect(repo.projects[PROJECT_NAME].dependencies).to.be.empty;
        expect(repo.projects[PROJECT_NAME].local_dev_dependencies).to.be.empty;
        const packWriteArgs = writeJSONToFile.args[writeJSONToFile.args.length - 2];
        expect(packWriteArgs[0]).to.equal(PACK_PATH);
        expect(packWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).be.empty;
        expect(pack.localDependencies).to.have.length(0);
        expect(pack.localDevDependencies).to.have.length(0);
        expect(yarn).to.be.calledOnceWithExactly(['remove', `@${REPO_NAME}/local-foo`], PROJECT_DIR);
      });
    });

    describe(descriptions.category('not in repository'), function() {
      let findRepository;
      let isSameRepo;
      let findPackage;
      let isFile;
      let glob;
      beforeEach(async function() {
        findRepository = sinon.fake.rejects();
        Rewire.__Rewire__('findRepository', findRepository);

        isSameRepo = sinon.fake.resolves({
          sameRepo: false,
          repoName: REPO_NAME
        });
        Rewire.__Rewire__('isSameRepo', isSameRepo);

        isFile = sinon.fake.resolves(true);
        Rewire.__Rewire__('isFile', isFile);
      });

      it('shoud add a regular dependency', async function() {
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {
                  baz: '^1.0.0'
                },
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);

        const {pack, repo} = await addRemove(['baz'], 'add', {});

        expect(findRepository).to.not.be.called;
        expect(md5).to.not.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(PACK_PATH);
        expect(lastWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.have.property('baz');
        expect(repo).to.be.undefined;
        expect(yarn).to.be.calledOnceWithExactly(['add', 'baz'], PROJECT_DIR);
      });

      it('should add a dev dependency', async function() {
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {
                  baz: '^1.0.0'
                },
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);

        const {pack, repo} = await addRemove(['baz'], 'add', {dev: true});

        expect(findRepository).to.not.be.called;
        expect(md5).to.not.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(PACK_PATH);
        expect(lastWriteArgs[1]).to.equal(pack);
        expect(pack.devDependencies).to.have.property('baz');
        expect(repo).to.be.undefined;
        expect(yarn).to.be.calledOnceWithExactly(['add', '--dev', 'baz'], PROJECT_DIR);
      });

      it('should remove a dependency', async function() {
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {
                  baz: '^1.0.0'
                },
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);

        const {pack, repo} = await addRemove(['baz'], 'remove', {});

        expect(findRepository).to.not.be.called;
        expect(md5).to.not.be.called;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(PACK_PATH);
        expect(lastWriteArgs[1]).to.equal(pack);
        expect(pack.devDependencies).be.empty;
        expect(repo).to.be.undefined;
        expect(yarn).to.be.calledOnceWithExactly(['remove', 'baz'], PROJECT_DIR);
      });

      it('should not allow adding a local dependency', async function() {
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {};
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);

        await expect(addRemove(['local-foo'], "add", {local: true})).to.eventually.be.rejected;
        expect(findPackage).to.be.calledOnce;
        expect(writeJSONToFile).to.not.be.called;
        expect(findRepository).to.not.be.called;
        expect(md5).to.not.be.called;
      });

      it('should not allow adding a local dev dependency', async function() {
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {};
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);

        await expect(addRemove(['local-foo'], "add", {local: true, dev: true})).to.eventually.be.rejected;
        expect(findPackage).to.be.calledOnce;
        expect(writeJSONToFile).to.not.be.called;
        expect(findRepository).to.not.be.called;
        expect(md5).to.not.be.called;
      });

      it('should not allow removing a local dependency', async function() {
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: [],
                localDevDependencies: ["local-foo"]
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {};
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([
          path.join(PROJECT_DIR, '.poly/dependencies/local-foo-v1.0.0.tgz')
        ]);
        Rewire.__Rewire__('glob', glob);

        await expect(addRemove(['local-foo'], "remove", {local: true})).to.eventually.be.rejectedWith(Error, 'Cannot modify local dependency when project not in the repository folder.');
        expect(findPackage).to.be.calledOnce;
        expect(writeJSONToFile).to.not.be.called;
        expect(findRepository).to.not.be.called;
        expect(md5).to.not.be.called;
      });

      it('should not relink local dependencies when adding a dependency', async function() {
        const localFooTarball = path.join(PROJECT_DIR, '.poly/dependencies/local-foo-v1.0.0.tgz')
        const scopedLocalFoo = `@${REPO_NAME}/local-foo`;
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            const dependencies = {
              baz: "^1.0.0"
            };
            dependencies[scopedLocalFoo] = `file:${localFooTarball}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            };
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([
          localFooTarball
        ]);
        Rewire.__Rewire__('glob', glob);

        const {pack, repo} = await addRemove(['baz'], 'add', {});

        expect(repo).to.be.undefined;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(PACK_PATH);
        expect(lastWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.have.property('baz', '^1.0.0');
        expect(pack.dependencies).to.not.have.property(scopedLocalFoo);
        expect(yarn).to.be.calledOnceWithExactly(['add', 'baz'], PROJECT_DIR);
      });

      it('should not relink local dependencies when removing a dependency', async function() {
        const localFooTarball = path.join(PROJECT_DIR, '.poly/dependencies/local-foo-v1.0.0.tgz')
        const scopedLocalFoo = `@${REPO_NAME}/local-foo`;
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {
                  baz: "^1.0.0"
                },
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            const dependencies = {};
            dependencies[scopedLocalFoo] = `file:${localFooTarball}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            };
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([
          localFooTarball
        ]);
        Rewire.__Rewire__('glob', glob);

        const {pack, repo} = await addRemove(['baz'], 'remove', {});

        expect(repo).to.be.undefined;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(PACK_PATH);
        expect(lastWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.be.empty;
        expect(yarn).to.be.calledOnceWithExactly(['remove', 'baz'], PROJECT_DIR);
      });

      it('should abort if a local tarball does not exist', async function() {
        const localFooTarball = path.join(PROJECT_DIR, '.poly/dependencies/local-foo-v1.0.0.tgz')
        const scopedLocalFoo = `@${REPO_NAME}/local-foo`;
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            return {};
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([]);
        Rewire.__Rewire__('glob', glob);

        await expect(addRemove(['baz'], 'add', {})).to.eventually.be.rejected;

        expect(writeJSONToFile).to.not.be.called;
        expect(yarn).to.not.be.called;
      });

      it('should relink if the install flag is present', async function() {
        const localFooTarball = path.join(PROJECT_DIR, '.poly/dependencies/local-foo-v1.0.0.tgz')
        const scopedLocalFoo = `@${REPO_NAME}/local-foo`;
        findPackage = sinon.fake(async function() {
          if (findPackage.callCount === 1) {
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: {},
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            }
          } else if (findPackage.callCount === 2) {
            const dependencies = {};
            dependencies[scopedLocalFoo] = `file:${localFooTarball}`;
            return {
              pack: {
                name: PROJECT_NAME,
                dependencies: dependencies,
                devDependencies: {},
                localDependencies: ["local-foo"],
                localDevDependencies: []
              },
              packPath: PACK_PATH
            };
          }
        });
        Rewire.__Rewire__('findPackage', findPackage);

        glob = sinon.fake.resolves([
          localFooTarball
        ]);
        Rewire.__Rewire__('glob', glob);

        const {pack, repo} = await addRemove([], 'add', {install: true});

        expect(repo).to.be.undefined;
        const lastWriteArgs = _.last(writeJSONToFile.args);
        expect(lastWriteArgs[0]).to.equal(PACK_PATH);
        expect(lastWriteArgs[1]).to.equal(pack);
        expect(pack.dependencies).to.be.empty;
        expect(yarn).to.be.calledTwice;
        expect(yarn).to.be.calledWithExactly(['remove', scopedLocalFoo], PROJECT_DIR);
        expect(yarn).to.be.calledWithExactly(['add', `${scopedLocalFoo}@file:${localFooTarball}`], PROJECT_DIR);
      });
    });
  });
}