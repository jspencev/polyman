import { expect, descriptions } from '@jspencev/test-util';
import readJSONFile from '%/util/readJSONFile';
import path from 'path';

const FIXTURES_DIR = path.resolve(__dirname, './fixtures/readJSONFile');

export default function() {
  describe(descriptions.exportFn('readJSONFile'), function() {
    it('should read a file with a JSON into an object', async function() {
      const jsonFile = path.join(FIXTURES_DIR, 'good.json');
      const obj = await readJSONFile(jsonFile);
      expect(obj).to.be.an('object');
      expect(obj).to.have.property('foo', 'bar');
    });

    it(`should throw an error if the file's contents cannot be parsed as JSON`, async function() {
      const jsonFile = path.join(FIXTURES_DIR, 'bad.json');
      await expect(readJSONFile(jsonFile)).to.eventually.be.rejected;
    });
  });
}