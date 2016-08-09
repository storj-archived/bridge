//  enable runtime transpilation to use ES6/7 in node
var config = {};

/*
 * If testing use simpler .babelrc with no plugins and the following presets:
 *   - es2015
 *   - stage-0
 */
if (process.env.NODE_ENV === 'test') {
  var fs = require('fs');
  var path = require('path');
  var babelrc = fs.readFileSync(path.resolve(__dirname, 'script', 'test', '.babelrc'));

  try {
    config = JSON.parse(babelrc);
  } catch (err) {
    console.error('==>     ERROR: Error parsing your .babelrc.');
    console.error(err);
  }
}

require('babel-core/register')(config);
// -- uncomment if `require`ing or `import`ing .scss files server-side
require.extensions['.scss'] = () => {
  return;
};
