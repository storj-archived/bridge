'use strict';

import 'colors';
import path from 'path';
import url from 'url';
import {spawn} from 'child_process';
import {sync as glob} from 'glob';
import {nextOnExit, killOnExit, nullProcess} from '../helpers/processes';
// import webpack from 'webpack';
// import webpackConfig from './webpack/e2e.config';

// webpack(webpackConfig, (err, stats) => {
//   const assets = stats.toJson().assetsByChunkName;
//   const testFiles = Object.keys(assets).map((chunk) => {
//     // TODO: get path prefix from factored out config from e2e.config.js
//     return path.resolve(__dirname, 'build', assets[chunk]);
//   });

const defaultDatabaseUrl = 'mongodb://localhost:27017/__storj-bridge-test';
const defaultBackendUrl = 'http://localhost:6382';
const typeName = path.basename(__filename, '.js');

const run = (next, options) => {
  console.info(`To add a ${typeName} test suite write some code in ${__filename}`.yellow);
  return next(null);

  const {
      mockBackend,
      backendUrl,
      databaseUrl,
  } = options;

  /*
   * Set environment variables used by webpack dev server
   * see <project root>/src/config.js
   */
  if (mockBackend) {
    process.env.APIHOST = 'localhost';
    process.env.APIPORT = Number(process.env.PORT) + 2 || 4002;
  } else {
    const {
        hostname,
        port
    } = url.parse(backendUrl || defaultBackendUrl);
    process.env.APIHOST = process.env.APIHOST || hostname;
    process.env.APIPORT = process.env.APIPORT || port;
    process.env.DATABASE_URL = process.env.DATABASE_URL || databaseUrl || defaultDatabaseUrl;
  }

  const defaultSpawnOptions = {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: ['ignore', process.stdout, process.stderr]
  };

  const e2eTestRoot = path.resolve(__dirname, '../../features');
  const testFiles = glob(e2eTestRoot + '/*{,*/*}.feature');

  console.info('starting dev server...'.magenta);
  const devServerProcess = spawn('node', [
    path.resolve(__dirname, '../../bin/server.js')
  ], {defaultSpawnOptions});

  console.info('starting cucumber...'.magenta);
  const cucumberProcess = spawn(path.resolve(__dirname, '../../gems/ruby/2.2.0/bin/cucumber'), [
    '-r', 'features',
    ...testFiles
  ], {...defaultSpawnOptions, stdio: 'inherit'});

  nextOnExit(cucumberProcess, next);

  killOnExit(cucumberProcess, [devServerProcess]);
  killOnExit(process, [cucumberProcess, devServerProcess]);
};

// });

run.typeName = typeName;
export default run;
