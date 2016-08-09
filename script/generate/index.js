'use strict';

import {spawn} from 'child_process';
import program from 'commander';
import path from 'path';

// GENERATE
program
  .option('-e, --email <email>', 'Email to generate credits and debits for')
  .option('-c, --credit <number>', 'Generate number of credits')
  .option('-d, --debit <number>', 'Generate number of debits')

program.parse(process.argv);

console.log("PATH: ", path.resolve(__dirname, 'factory.rb'))

const factory_process = spawn('/usr/bin/env', [
  'ruby', path.resolve(__dirname, 'factory.rb')
], {cwd: process.cwd(), stdio: 'inherit'});

console.log(program.email);
console.log(program.credit);
console.log(program.debit);
