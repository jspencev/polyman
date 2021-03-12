import { expect, sinon, descriptions } from '@jspencev/test-util';
import getBuiltTarballDir, { __RewireAPI__ as Rewire } from '%/util/getBuiltTarballDir';
import path from 'path';

const APP_ROOT_PATH = '/repo/project';

export default function() {
  describe(descriptions.exportFn('getBuiltTarballDir'), function() {
    const DEFAULT_BUILT_DIR = './foo/build';
    let getAppRootPath;
    beforeEach(async function() {
      Rewire.__Rewire__('DEFAULT_BUILT_DIR', DEFAULT_BUILT_DIR);
    });

    it('should get the built tarball directory', async function() {
      getAppRootPath = sinon.fake.resolves(APP_ROOT_PATH);
      Rewire.__Rewire__('getAppRootPath', getAppRootPath);

      const builtTarballDir = await getBuiltTarballDir(APP_ROOT_PATH);
      expect(getAppRootPath).to.be.calledOnceWithExactly(APP_ROOT_PATH);
      expect(builtTarballDir).to.equal(path.resolve(APP_ROOT_PATH, DEFAULT_BUILT_DIR));
    });

    it('should error when the projectDir is not in a package', async function() {
      getAppRootPath = sinon.fake.rejects();
      Rewire.__Rewire__('getAppRootPath', getAppRootPath);

      await expect(getBuiltTarballDir('wrong')).to.eventually.be.rejected;
      expect(getAppRootPath).to.be.calledOnceWithExactly('wrong');
    });
  });
}