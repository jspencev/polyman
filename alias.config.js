const path = require('path');

let rootDir = 'src';
if (process.env.BUILD) {
  rootDir = 'dist';
}

function alias(p) {
  return './' + path.join(rootDir, p);
}

module.exports = {
  default: {
    '%root': alias('..'),
    '%': alias('.')
  },
  appRoot: __dirname
}