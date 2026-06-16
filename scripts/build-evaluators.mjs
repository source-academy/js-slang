#!/usr/bin/env node
import { spawn } from 'node:child_process';

// Keep in sync with exports in src/conductor/index.ts.
const targets = ['SourceEvaluator1', 'JSCseEvaluator3', 'JSCseEvaluator4'];

function buildTarget(target) {
  console.log(`\nBuilding ${target}...\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--max-old-space-size=4096', './node_modules/.bin/rollup', '-c', 'rollup.config.evaluator.mjs'],
      {
        env: { ...process.env, EVALUATOR: target },
        stdio: 'inherit',
        shell: false,
      },
    );
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed for ${target} (exit ${code})`));
    });
  });
}

for (const target of targets) {
  await buildTarget(target);
}
