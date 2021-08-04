import { expect, sinon, descriptions } from "@jspencev/test-util";
import getBuiltTarballPath, {
  __RewireAPI__ as Rewire,
} from "%/util/getBuiltTarballPath";

export default function () {
  describe(descriptions.exportFn("getBuiltTarballPath"), function () {
    let getBuiltTarballDir;
    let getTarballFilename;

    it("should get the absolute built tarball path for the submitted project directory", async function () {
      getBuiltTarballDir = sinon.fake.resolves("/foo");
      Rewire.__Rewire__("getBuiltTarballDir", getBuiltTarballDir);

      getTarballFilename = sinon.fake.resolves("bar.tgz");
      Rewire.__Rewire__("getTarballFilename", getTarballFilename);

      const builtTarballPath = await getBuiltTarballPath("/foo");
      expect(getBuiltTarballDir).to.be.calledOnceWithExactly("/foo");
      expect(getTarballFilename).to.be.calledOnceWithExactly("/foo");
      expect(builtTarballPath).to.equal("/foo/bar.tgz");
    });
  });
}
