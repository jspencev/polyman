import { hooks } from "@jspencev/test-util";
const { beforeEachHooks, afterEachHooks, afterHooks } = hooks;
const { initTestVars } = beforeEachHooks;
const { rewireResetAll, cleanTestVars, sinonRestore } = afterEachHooks;
const { exitProcess } = afterHooks;

export default {
  before: [initTestVars],
  beforeEach: {
    pre: [initTestVars],
  },
  afterEach: {
    post: [sinonRestore, rewireResetAll, cleanTestVars],
  },
  after: [exitProcess],
};
