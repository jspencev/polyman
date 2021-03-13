import { expect, sinon, descriptions } from '@jspencev/test-util';
import cleanYarnLock, { __RewireAPI__ as Rewire } from '%/util/cleanYarnLock';
import path from 'path';

const PROJECT_DIR = '/foo';
const NEW_LOCKFILE = 'lockfile contents';

export default function() {
  describe(descriptions.exportFn('cleanYarnLock'), function() {
    let getAppRootPath;
    let writeFileIfNotExist;
    let readJSONFile;
    let lockfile;
    let fs;
    beforeEach(async function() {
      getAppRootPath = sinon.fake.resolves(PROJECT_DIR);
      Rewire.__Rewire__('getAppRootPath', getAppRootPath);

      writeFileIfNotExist = sinon.fake.resolves();
      Rewire.__Rewire__('writeFileIfNotExist', writeFileIfNotExist);

      readJSONFile = sinon.fake.resolves({
        repository_name: 'repo'
      });
      Rewire.__Rewire__('readJSONFile', readJSONFile);

      lockfile = {
        stringify: sinon.fake.returns(NEW_LOCKFILE)
      }

      fs = {
        readFile: sinon.fake.resolves('')
      };
      Rewire.__Rewire__('fs', fs);
    });

    it('should remove all references to a repo in the yarn lockfile', async function() {
      lockfile.parse = sinon.fake.returns({
        object: {
        '@other': 'whatever',
        '@repo': 'whatever',
        'repo': 'whatever'
        }
      });
      Rewire.__Rewire__('lockfile', lockfile);

      await cleanYarnLock(PROJECT_DIR);

      expect(readJSONFile).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, 'config.poly'));
      expect(lockfile.stringify).to.be.calledAfter(lockfile.parse);
      expect(lockfile.parse).to.be.calledOnce;
      expect(lockfile.stringify).to.be.calledOnceWithExactly({
        '@other': 'whatever',
        'repo': 'whatever'
      });
      expect(writeFileIfNotExist).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, 'yarn.lock'), NEW_LOCKFILE);
    });

    it('should remove all references to a specified repo without @', async function() {
      lockfile.parse = sinon.fake.returns({
        object: {
        '@other': 'whatever',
        '@repo': 'whatever',
        'repo': 'whatever'
        }
      });
      Rewire.__Rewire__('lockfile', lockfile);

      await cleanYarnLock(PROJECT_DIR, 'other');

      expect(readJSONFile).to.not.be.called;
      expect(lockfile.stringify).to.be.calledAfter(lockfile.parse);
      expect(lockfile.parse).to.be.calledOnce;
      expect(lockfile.stringify).to.be.calledOnceWithExactly({
        '@repo': 'whatever',
        'repo': 'whatever'
      });
      expect(writeFileIfNotExist).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, 'yarn.lock'), NEW_LOCKFILE);
    });

    it('should remove all references to a specified repo with @', async function() {
      lockfile.parse = sinon.fake.returns({
        object: {
        '@other': 'whatever',
        '@repo': 'whatever',
        'repo': 'whatever'
        }
      });
      Rewire.__Rewire__('lockfile', lockfile);

      await cleanYarnLock(PROJECT_DIR, 'other');

      expect(readJSONFile).to.not.be.called;
      expect(lockfile.stringify).to.be.calledAfter(lockfile.parse);
      expect(lockfile.parse).to.be.calledOnce;
      expect(lockfile.stringify).to.be.calledOnceWithExactly({
        '@repo': 'whatever',
        'repo': 'whatever'
      });
      expect(writeFileIfNotExist).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, 'yarn.lock'), NEW_LOCKFILE);
    });

    it(`should gracefully abort if there's no config.poly and no specified repo`, async function() {
      readJSONFile = sinon.fake.rejects();
      Rewire.__Rewire__('readJSONFile', readJSONFile);

      await cleanYarnLock(PROJECT_DIR);

      expect(writeFileIfNotExist).to.not.be.called;
    });

    it('should abort gracefully if the lockfile does not exist', async function() {
      fs.readFile = sinon.fake.rejects();
      Rewire.__Rewire__('fs', fs);

      await cleanYarnLock(PROJECT_DIR);

      expect(writeFileIfNotExist).to.not.be.called;
    });
  });
}