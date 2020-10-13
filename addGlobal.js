console.log(`yarn add global file:${__dirname}`);
require('child_process').spawn('yarn', ['global', 'add', `file:${__dirname}`], {stdio: 'inherit'}).on('exit', function() {
  process.exit();
});