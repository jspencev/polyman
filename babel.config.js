module.exports = function (api) {
  api.cache(true);

  const presets = [
    ['@babel/preset-env', {
    useBuiltIns: 'usage',
    corejs: 3
    }]
  ];

  const plugins = [
    'babel-plugin-transform-inline-environment-variables',
    'babel-plugin-minify-dead-code-elimination',
  ];

  return {
    presets,
    plugins
  };
}