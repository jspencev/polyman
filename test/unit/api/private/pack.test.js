import { expect, sinon, descriptions } from '@jspencev/test-util';
import pack, { __RewireAPI__ as Rewire } from '%/api//private/pack';
import path from 'path';

const PROJECT_DIR = '/foo';
const TARBALL_FILENAME = 'bar.tgz';
const BUILT_DIR = path.join(PROJECT_DIR, 'build');
const BUILT_PATH = path.join(BUILT_DIR, TARBALL_FILENAME);

export default function() {
  describe(descriptions.exportFn('pack'), function() {
    let moveFile;
    let yarn;
    let getTarballFilename;
    let getBuiltTarballDir;
    beforeEach(async function() {
      moveFile = sinon.fake.resolves();
      Rewire.__Rewire__('moveFile', moveFile);

      yarn = sinon.fake.resolves();
      Rewire.__Rewire__('yarn', yarn);

      getTarballFilename = sinon.fake.resolves(TARBALL_FILENAME);
      Rewire.__Rewire__('getTarballFilename', getTarballFilename);

      getBuiltTarballDir = sinon.fake.resolves(BUILT_DIR);
      Rewire.__Rewire__('getBuiltTarballDir', getBuiltTarballDir);
    });

    it('should pack a tarball when a project object is submitted', async function() {
      const tarballPath = await pack({
        local_path: PROJECT_DIR
      });

      expect(yarn).to.be.calledOnceWithExactly('pack', PROJECT_DIR);
      expect(moveFile).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, TARBALL_FILENAME), BUILT_PATH);
      expect(moveFile).to.be.calledAfter(yarn);
      expect(getTarballFilename).to.be.calledOnceWithExactly(PROJECT_DIR);
      expect(getBuiltTarballDir).to.be.calledOnceWithExactly(PROJECT_DIR);
      expect(tarballPath).to.equal(BUILT_PATH);
    });

    it('should pack a tarball when a project directory is submitted', async function() {
      const tarballPath = await pack(PROJECT_DIR);

      expect(yarn).to.be.calledOnceWithExactly('pack', PROJECT_DIR);
      expect(moveFile).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, TARBALL_FILENAME), BUILT_PATH);
      expect(moveFile).to.be.calledAfter(yarn);
      expect(getTarballFilename).to.be.calledOnceWithExactly(PROJECT_DIR);
      expect(getBuiltTarballDir).to.be.calledOnceWithExactly(PROJECT_DIR);
      expect(tarballPath).to.equal(BUILT_PATH);
    });

    it('should pack a tarball to a specific location', async function() {
      const tarballPath = await pack(PROJECT_DIR, '/baz');

      expect(yarn).to.be.calledOnceWithExactly('pack', PROJECT_DIR);
      expect(moveFile).to.be.calledOnceWithExactly(path.join(PROJECT_DIR, TARBALL_FILENAME), path.join('/baz', TARBALL_FILENAME));
      expect(moveFile).to.be.calledAfter(yarn);
      expect(getTarballFilename).to.be.calledOnceWithExactly(PROJECT_DIR);
      expect(getBuiltTarballDir).to.not.be.called;
      expect(tarballPath).to.equal(path.join('/baz', TARBALL_FILENAME));
    });
  });
}