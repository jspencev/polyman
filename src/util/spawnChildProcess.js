const child_process = require('child_process');

export default function spawnChildProcess(cmd, args, opts = {}) {
  return new Promise(function(resolve) {
    opts = Object.assign({stdio: 'inherit'}, opts);
    child_process.spawn(cmd, args, opts).on('exit', function(code, signal) {
      resolve({code, signal});
    });
  });
}