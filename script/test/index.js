'use strict';

import fs from 'fs';
import path from 'path';
import program from 'commander';
import {eachSeries} from 'async';
import 'colors';

import unitSuite from './unit';
import integrationSuite from './integration';
import e2eSuite from './e2e';

const pkg = require('../../package.json');
const version = pkg.version;

program
    .version(version)
    .option('-a, --all', 'Run all tests')
    .option('-u, --unit', 'Run unit tests')
    .option('-e, --e2e', 'Run end-to-end tests')
    .option('-v, --visual', 'Run visual regression tests')
    // .option('-l, --lint', 'Run JSHint linter')
    .option('-M, --no-mock-backend [url]',
        'Use bridge backend at `url` instead of the mock backend; ' +
        'defaults to http://localhost:6382; ' +
        'requires running bridge server (only applicable for --e2e and --visual; ' +
        'overriden by APIHOST and APIPORT env vars)')
    .option('-D, --database-url [url]',
        'Use database at `url`; ' +
        'defaults to mongodb://localhost:27017/__storj-bridge-test; ' +
        '(only applicable when using -M; ' +
        'overriden by DATABASE_URL env var)')
    .on('--help', () => {
      console.log('  Examples:');
      console.log('');
      console.log('    $ npm test -- --unit');
      console.log('    $ npm test -- -u');
      console.log('    $ npm test -- --e2e --unit');
      console.log('    $ npm test -- -e -u');
      console.log('    $ npm test -- -eu');
      console.log('');
    })
    .parse(process.argv)
;

const {
    mockBackend,
    databaseUrl
} = program;

const suiteOptions = {
  databaseUrl
};

if (typeof(mockBackend) === 'boolean') {
  suiteOptions.mockBackend = mockBackend;
} else {
  suiteOptions.mockBackend = false;
  suiteOptions.backendUrl = mockBackend;
}

/*
 * Test entry points are expected to be in a file with the same name as the
 * corresponding commander `type` cli option (e.g.: `--e2e` = e2e.js), and
 * located in the `scripts/test` directory.
 */
const typeSuites = [
  unitSuite,
  integrationSuite,
  e2eSuite
];

// no types specified, run all
const noTypes = !(typeSuites.some(suite => !!program[suite.typeName]));

console.log(`types: ${typeSuites.map(s => s.typeName)}`);

eachSeries(typeSuites,
    (suite, next) => {
      const typeName = suite.typeName;

      // checking for `-a || --all`, specific type option, or no type options
      console.log(`typeName: ${typeName}`);
      console.log(`noTypes: ${noTypes}`);
      if (program.all || program[typeName] || noTypes) {
        console.info(`BEGINNING tests for type ${typeName}:`.cyan);
        const typePath = path.resolve(__dirname, `${typeName}.js`);

        fs.stat(typePath, (err) => {
          if (err) {
            /*
             * report errors via `console.error`; async exits loop
             * if `next` is called with an error
             */
            console.error(`${err} - CONTINUING TO NEXT SUITE...`.cyan);
            next(null);
          } else {
            /*
             * Run tests - hand next off to each test so that test-type suites run serially.
             */
            suite(next, suiteOptions);
          }
        });
      } else {
        next(null);
      }
    }, () => {
      console.info('ALL SUITES FINISHED'.cyan);
    }
);

