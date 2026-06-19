#!/usr/bin/env node
import { spawn } from 'node:child_process';

// Keep in sync with the evaluator classes exported from src/conductor/index.ts.
const targets = ['SourceStepperEvaluator1', 'SourceStepperEvaluator2'];

function buildTarget(target) {
  console.log(`\nBuilding ${target}...\n`);
  return new Promise((resolve, reject) => {
    const child = spawn('rollup', ['-c', 'rollup.config.evaluator.mjs'], {
      env: { ...process.env, EVALUATOR: target },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed for ${target} (exit ${code})`));
    });
    child.on('error', reject);
  });
}

// Build sequentially so the shared TypeScript compilation does not race.
for (const target of targets) {
  await buildTarget(target);
}
