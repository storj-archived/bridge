#!/env/node
'use strict';

// TODO: maybe use webpack to build/cache static test output to speed things up
// import webpack from 'webpack';
// import webpackConfig from '../../webpack/e2e.test.config';

// const path = require('path');
// const webpack = require('webpack');
// const webpackConfig = require('../script/test/webpack/test.config');
//
// webpack(webpackConfig, (err) => {
//   if (err) {
//     throw err;
//   } else {
//     require(path.resolve(webpackConfig.context, webpackConfig.output.path, 'index'));
//   }
// });

// TODO: if using webpack for static output, this should be conditional
require('../server.babel');
require('../script/test/index');
