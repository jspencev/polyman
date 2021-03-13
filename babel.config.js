const aliasConfig = require('./alias.config').default;

module.exports = function (api) {
  api.cache(true);

  const presets = [
    ['@babel/preset-env', {
      useBuiltIns: 'usage',
      corejs: 3,
      targets: {
        node: 10
      }
    }]
  ];

  const plugins = [
    ['babel-plugin-module-resolver', {
      alias: aliasConfig
    }]
  ];

  if (process.env.NODE_ENV === 'test') {
    plugins.push('babel-plugin-istanbul');
    plugins.push('babel-plugin-rewire');
  }

  return {
    presets,
    plugins
  };
}