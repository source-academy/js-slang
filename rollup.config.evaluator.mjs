import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { fileURLToPath } from 'node:url';
import esbuild from 'rollup-plugin-esbuild';
import nodePolyfills from 'rollup-plugin-polyfill-node';

// Set by scripts/build-evaluators.mjs, one child process per target.
const EVALUATOR = process.env.EVALUATOR;
if (!EVALUATOR) {
  throw new Error('EVALUATOR env var must be set. Use scripts/build-evaluators.mjs.');
}

/**
 * Rewrites a handful of static `require('<literal>')` calls that live inside ES modules into
 * hoisted ESM imports, so rollup can resolve and bundle them.
 *
 * Needed for `src/parser/source/typed/typeParser.ts`, whose
 * `Parser.extend(tsPlugin, require('acorn-class-fields'))` runs at module top level.
 * `@rollup/plugin-commonjs` leaves it alone even with `transformMixedEsModules`, and in an IIFE
 * bundle `require` is a free variable — so the worker would die with a ReferenceError the moment
 * it loaded, before conductor had wired up any channel to report it on. Verified: without this,
 * the emitted bundle still contains a literal `require("acorn-class-fields")`.
 *
 * The call cannot simply be changed to an `import` in js-slang's source: the package is CommonJS
 * (`module.exports = fn`, no `.default`), and this project compiles with `module: commonjs` and
 * `esModuleInterop` off, so a default import emits `.default` (undefined) while a namespace import
 * is what the CJS build needs but breaks under rollup's interop. Keeping the fix at build time
 * leaves the published library's behaviour untouched.
 *
 * Approach borrowed from #2004.
 */
function rewriteStaticRequires(modules) {
  const pattern = new RegExp(`require\\((['"])(${modules.join('|')})\\1\\)`, 'g');
  return {
    name: 'rewrite-static-requires',
    transform(code) {
      pattern.lastIndex = 0;
      if (!pattern.test(code)) return null;
      pattern.lastIndex = 0;
      const imports = new Map();
      const replaced = code.replace(pattern, (_match, _quote, name) => {
        const local = `__req_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        imports.set(name, local);
        return local;
      });
      const header = [...imports]
        .map(([name, local]) => `import ${local} from '${name}';`)
        .join('\n');
      return { code: `${header}\n${replaced}`, map: null };
    },
  };
}

const shim = name => fileURLToPath(new URL(`./scripts/evaluator-shims/${name}`, import.meta.url));

// The frontend loads each evaluator into a Worker built from a blob: URL. A Worker has no
// `document`, and js-slang's dependency tree still expects a CommonJS-ish `global`/`process` to
// exist at module scope, so both are defined before any bundled code runs.
const BROWSER_GLOBALS_BANNER = [
  'var global = typeof globalThis !== "undefined" ? globalThis : self;',
  'var process = (typeof globalThis !== "undefined" && globalThis.process) || ' +
    '{ env: { NODE_ENV: "production" }, argv: [], platform: "browser", version: "", ' +
    'versions: {}, nextTick: function (f) { Promise.resolve().then(f); }, ' +
    'cwd: function () { return "/"; }, browser: true };',
].join('\n');

export default {
  treeshake: { moduleSideEffects: false },
  input: 'src/conductor/initialise.ts',
  output: {
    file: `dist/${EVALUATOR}.js`,
    format: 'iife',
    name: 'JsSlangEvaluator',
    sourcemap: true,
    banner: BROWSER_GLOBALS_BANNER,
  },
  plugins: [
    rewriteStaticRequires(['acorn-class-fields']),
    replace({
      preventAssignment: true,
      values: { __EVALUATOR__: EVALUATOR },
    }),
    alias({
      entries: [
        { find: 'path', replacement: shim('path.mjs') },
        // Pulled in transitively by source-map's Node build; unreachable in the browser.
        { find: 'inspector', replacement: shim('empty.mjs') },
      ],
    }),
    esbuild({ target: 'es2020', sourceMap: true }),
    commonjs({ transformMixedEsModules: true }),
    json(),
    nodeResolve({ preferBuiltins: false, browser: true }),
    nodePolyfills(),
    terser({ compress: { dead_code: true, passes: 2 } }),
  ],
};
