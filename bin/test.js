#!/env/node

// TODO: maybe use webpack to build/cache static test output to speed things up
// import webpack from 'webpack';
// import webpackConfig from '../../webpack/e2e.test.config';

// TODO: if using webpack for static output, this should be conditional
require('babel-core/register'); 
require('../scripts/test/index');
