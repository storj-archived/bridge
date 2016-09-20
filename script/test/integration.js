'use strict';

import path from 'path';
import 'colors';
import {spawn} from 'child_process';
import {sync as glob} from 'glob';
import {nextOnExit, killOnExit, nullProcess} from '../helpers/processes';

const typeName = path.basename(__filename, '.js');

const run = (next) => {

  const defaultSpawnOptions = {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: ['ignore', process.stdout, process.stderr]
  };

  const unitTestRoot = path.resolve(__dirname, '../../test');
  const testFiles = glob(unitTestRoot + '/*{,*/*}.integration.js');

  console.info('starting mocha...'.magenta);
  const mochaProcess = spawn('./node_modules/.bin/_mocha', [
    // NB: Enable if we want to use ES6/7 in test code
    // '--compiler js:server.bael.js',
    ...testFiles
  ], {...defaultSpawnOptions, stdio: 'inherit'});

  nextOnExit(mochaProcess, next);
  killOnExit(process, mochaProcess);
};

run.typeName = typeName;
export default run;
