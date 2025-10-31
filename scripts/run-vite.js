#!/usr/bin/env node
if (!process.env.ROLLUP_SKIP_NODE_RESOLUTION) {
  process.env.ROLLUP_SKIP_NODE_RESOLUTION = '1';
}

if (!process.env.ROLLUP_DISABLE_NATIVE) {
  process.env.ROLLUP_DISABLE_NATIVE = '1';
}

const cliPath = require.resolve('vite/bin/vite.js');
const command = process.argv[2] || 'dev';
const extraArgs = process.argv.slice(3);

process.argv = [process.argv[0], cliPath, command, ...extraArgs];

require(cliPath);
