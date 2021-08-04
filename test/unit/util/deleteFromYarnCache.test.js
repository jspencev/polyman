import { expect, sinon, descriptions } from "@jspencev/test-util";
import deleteFromYarnCache, {
  __RewireAPI__ as Rewire,
} from "%/util/deleteFromYarnCache";

export default function () {
  describe(descriptions.exportFn("deleteFromYarnCache"), function () {
    let spawnChildProcess;
    let glob;
    let rimraf;
    let findRepository;
    beforeEach(async function () {
      spawnChildProcess = sinon.fake.resolves({ result: "/yarn_cache_dir" });
      Rewire.__Rewire__("spawnChildProcess", spawnChildProcess);

      glob = sinon.fake.resolves(["/yarn_cache_dir/npm-foo-repo-xyz"]);
      Rewire.__Rewire__("glob", glob);

      rimraf = sinon.fake.resolves();
      Rewire.__Rewire__("rimraf", rimraf);
    });

    describe(descriptions.category("in repo"), function () {
      beforeEach(async function () {
        findRepository = sinon.fake.resolves({ repo: { name: "foo-repo" } });
        Rewire.__Rewire__("findRepository", findRepository);
      });

      it("should find and remove files without a name based on the repository", async function () {
        await deleteFromYarnCache();
        expect(findRepository).to.be.calledOnce;
        expect(rimraf).to.be.calledTwice;
        expect(glob).to.be.calledOnceWithExactly(
          "/yarn_cache_dir/npm-@foo-repo*"
        );
      });

      it("should find and remove files with a scope only", async function () {
        await deleteFromYarnCache("@bar");
        expect(findRepository).to.not.be.called;
        expect(rimraf).to.be.calledTwice;
        expect(glob).to.be.calledOnceWithExactly("/yarn_cache_dir/npm-@bar*");
      });

      it("should find and remove files with a package name only", async function () {
        await deleteFromYarnCache("bar");
        expect(findRepository).to.not.be.called;
        expect(rimraf).to.be.calledTwice;
        expect(glob).to.be.calledOnceWithExactly("/yarn_cache_dir/npm-bar*");
      });

      it("should find and remove files with a scoped package", async function () {
        await deleteFromYarnCache("@bar/baz");
        expect(findRepository).to.not.be.called;
        expect(rimraf).to.be.calledTwice;
        expect(glob).to.be.calledOnceWithExactly(
          "/yarn_cache_dir/npm-@bar-baz*"
        );
      });
    });

    describe(descriptions.category("not in repository"), function () {
      beforeEach(async function () {
        findRepository = sinon.fake.rejects();
        Rewire.__Rewire__("findRepository", findRepository);
      });

      it("should find and remove with a name", async function () {
        await deleteFromYarnCache("@bar");
        expect(rimraf).to.be.calledTwice;
        expect(glob).to.be.calledOnceWithExactly("/yarn_cache_dir/npm-@bar*");
      });

      it("should only remove .tmp without a name", async function () {
        await deleteFromYarnCache();
        expect(rimraf).to.be.calledOnce;
        expect(glob).to.not.be.called;
      });
    });
  });
}
