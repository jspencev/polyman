const thenifyAll = require('thenify-all');
const fs = thenifyAll(require('fs'));

export default async function moveFile(oldPath, newPath) {
  try {
    await fs.rename(oldPath, newPath);
  } catch(e) {
    if (e.code === 'EXDEV') {
      await copy();
    }
  }
}

function copy(oldPath, newPath) {
  return new Promise(function(resolve, reject) {
    var readStream = fs.createReadStream(oldPath);
    var writeStream = fs.createWriteStream(newPath);

    readStream.on('error', reject);
    writeStream.on('error', reject);

    readStream.on('close', function () {
      fs.unlink(oldPath, resolve);
    });

    readStream.pipe(writeStream);
  });
}