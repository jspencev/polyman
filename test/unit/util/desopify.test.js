import { expect, descriptions } from '@jspencev/test-util';
import descopify from '%/util/descopify';

export default function() {
  describe(descriptions.exportFn('descopify'), function() {
    it('should descopify a scoped name', async function() {
      const descoped = descopify('@foo/bar');
      expect(descoped).to.equal('bar');
    });

    it('should descopify a non-scoped name', async function() {
      const descoped = descopify('foo');
      expect(descoped).to.equal('foo');
    });
  });
}