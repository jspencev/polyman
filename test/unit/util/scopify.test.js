import { expect, descriptions } from '@jspencev/test-util';
import scopify from '%/util/scopify';

export default function() {
  describe(descriptions.exportFn('scopify'), function() {
    it('should scopify when the repository name is submitted', async function() {
      const scopedName = scopify('foo', 'bar');
      expect(scopedName).to.equal('@bar/foo');
    });

    it('should scopify when the repository object is submitted', async function() {
      const repo = {
        name: 'bar'
      };
      const scopedName = scopify('foo', repo);
      expect(scopedName).to.equal('@bar/foo');
    });
  });
}