#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';

// Run rollup through its own JS entry rather than spawning the bare name: on Windows only
// rollup.CMD is on PATH and spawn() does not do the PATHEXT lookup needed to find it.
const rollupBin = createRequire(import.meta.url).resolve('rollup/dist/bin/rollup');

// Keep in sync with the exports in src/conductor/index.ts.
const allTargets = [
  'SourceEvaluator1',
  'SourceEvaluator2',
  'SourceEvaluator3',
  'SourceEvaluator4',
  'SourceCseEvaluator3',
  'SourceCseEvaluator4',
];

function buildTarget(target) {
  console.log(`\nBuilding ${target}...\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [rollupBin, '-c', 'rollup.config.evaluator.mjs'], {
      env: { ...process.env, EVALUATOR: target },
      stdio: 'inherit',
    });
    child.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`Build failed for ${target} (exit ${code})`)),
    );
  });
}

/**
 * Runs `tasks` with at most `limit` in flight. Every target is its own rollup child process, and
 * firing all of them at once on a 2-vCPU CI runner oversubscribes memory badly enough that
 * individual builds balloon and the runner can lose its heartbeat (py-slang hit exactly this).
 * Capping at the host's core count keeps every worker actually running.
 */
async function runWithConcurrencyLimit(limit, tasks) {
  let next = 0;
  async function worker() {
    for (let i = next++; i < tasks.length; i = next++) {
      await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

const requested = process.argv.slice(2);
const invalid = requested.filter(t => !allTargets.includes(t));
if (invalid.length > 0) {
  console.error(`Unknown target(s): ${invalid.join(', ')}. Expected: ${allTargets.join(', ')}`);
  process.exit(1);
}
const targets = requested.length > 0 ? requested : allTargets;

await runWithConcurrencyLimit(
  cpus().length,
  targets.map(target => () => buildTarget(target)),
).catch(e => {
  console.error(e.message);
  process.exit(1);
});
