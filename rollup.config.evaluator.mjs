import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { fileURLToPath } from 'node:url';
import esbuild from 'rollup-plugin-esbuild';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const EVALUATOR = process.env.EVALUATOR;
if (!EVALUATOR) {
  throw new Error('EVALUATOR env var must be set. Use scripts/build-evaluators.mjs.');
}

const shim = name => fileURLToPath(new URL(`./scripts/evaluator-shims/${name}`, import.meta.url));

// js-slang has a few inline `require('<literal>')` calls inside ES modules that
// @rollup/plugin-commonjs cannot rewrite (it skips modules its acorn parser rejects as TS).
// This transform rewrites those static requires into hoisted ESM imports first.
function rewriteStaticRequires(modules) {
  const pattern = new RegExp(`require\\((['"])(${modules.join('|')})\\1\\)`, 'g');
  return {
    name: 'rewrite-static-requires',
    transform(code) {
      if (!pattern.test(code)) return null;
      pattern.lastIndex = 0;
      const imports = new Map();
      const replaced = code.replace(pattern, (_match, _quote, name) => {
        const local = `__req_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        imports.set(name, local);
        return local;
      });
      const header = [...imports].map(([name, local]) => `import ${local} from '${name}';`).join('\n');
      return { code: `${header}\n${replaced}`, map: null };
    },
  };
}

function plugins() {
  return [
    rewriteStaticRequires(['acorn-class-fields']),
    replace({
      preventAssignment: true,
      values: { __EVALUATOR__: EVALUATOR },
    }),
    alias({
      entries: [
        { find: 'path', replacement: shim('path.mjs') },
        { find: 'inspector', replacement: shim('empty.mjs') },
      ],
    }),
    esbuild({ target: 'es2020', sourceMap: true }),
    commonjs({ transformMixedEsModules: true }),
    json(),
    nodeResolve({ preferBuiltins: false, browser: true }),
    nodePolyfills(),
    terser({ compress: { dead_code: true, passes: 2 } }),
  ];
}

export default {
  treeshake: { moduleSideEffects: false },
  input: 'src/conductor/initialise.ts',
  output: {
    file: `dist/${EVALUATOR}.js`,
    format: 'iife',
    name: 'JsSlangWorker',
    sourcemap: true,
    banner: [
      'var global = typeof globalThis !== "undefined" ? globalThis : self;',
      'var process = (typeof globalThis !== "undefined" && globalThis.process) || ' +
        '{ env: { NODE_ENV: "production" }, argv: [], platform: "browser", version: "", ' +
        'versions: {}, nextTick: function (f) { Promise.resolve().then(f); }, ' +
        'cwd: function () { return "/"; }, browser: true };',
    ].join('\n'),
  },
  plugins: plugins(),
};
