import hasha from 'hasha';

export default async function hashFile(filepath) {
  const options = {
    encoding: 'base64',
    algorithm: 'md5'
  };

  const hash = await hasha.fromFile(filepath, options);
  return hash;
}