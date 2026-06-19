import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { fileURLToPath } from 'node:url';
import esbuild from 'rollup-plugin-esbuild';
import nodePolyfills from 'rollup-plugin-polyfill-node';

// EVALUATOR is set per-target by scripts/build-evaluators.mjs.
const EVALUATOR = process.env.EVALUATOR;
if (!EVALUATOR) {
  throw new Error('EVALUATOR env var must be set. Use scripts/build-evaluators.mjs.');
}

const shim = name => fileURLToPath(new URL(`./scripts/evaluator-shims/${name}`, import.meta.url));

/**
 * js-slang has a few inline `require('<literal>')` calls inside ES modules (e.g.
 * `parser/source/typed/typeParser.ts`: `Parser.extend(tsPlugin, require('acorn-class-fields'))`).
 * `@rollup/plugin-commonjs` cannot rewrite these: it decides whether a module has requires by
 * parsing the *original* TS source, which its acorn parser rejects, so it skips the module.
 * Left untouched, `require` is undefined in the Worker and throws at load. This transform rewrites
 * those static requires into hoisted ESM imports, which nodeResolve/nodePolyfills then bundle.
 */
function rewriteStaticRequires(modules) {
  const pattern = new RegExp(`require\\((['"])(${modules.join('|')})\\1\\)`, 'g');
  return {
    name: 'rewrite-static-requires',
    transform(code) {
      const imports = new Map();
      const replaced = code.replace(pattern, (_match, _quote, name) => {
        const local = `__req_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        imports.set(name, local);
        return local;
      });
      if (imports.size === 0) return null;
      const header = [...imports].map(([name, local]) => `import ${local} from '${name}';`).join('\n');
      return { code: `${header}\n${replaced}`, map: null };
    },
  };
}

function plugins() {
  return [
    // Must run before esbuild so it sees the original `require(...)` calls.
    rewriteStaticRequires(['acorn-class-fields']),
    // Replace the __EVALUATOR__ placeholder in src/conductor/initialise.ts with the chosen class.
    replace({
      preventAssignment: true,
      values: { __EVALUATOR__: EVALUATOR },
    }),
    // `path` (needs the `posix` export the node polyfill lacks) and node-only `inspector`.
    alias({
      entries: [
        { find: 'path', replacement: shim('path.mjs') },
        { find: 'inspector', replacement: shim('empty.mjs') },
      ],
    }),
    // Transpile-only (no full typecheck): js-slang is already typechecked by `yarn build:slang`,
    // and esbuild avoids the module-sensitive @ts-expect-error strictness of the typecheck plugin.
    // Must run BEFORE commonjs so commonjs sees plain JS (it cannot parse TS type annotations) and
    // can rewrite inline `require(...)` calls that js-slang uses inside ES modules
    // (e.g. parser/source/typed/typeParser.ts: `Parser.extend(tsPlugin, require('acorn-class-fields'))`).
    esbuild({ target: 'es2020', sourceMap: true }),
    // `transformMixedEsModules` lets commonjs rewrite `require()` calls that live in modules which
    // also use `import`/`export`; without it those requires leak through and throw
    // `require is not defined` in the Worker.
    commonjs({ transformMixedEsModules: true }),
    json(),
    nodeResolve({ preferBuiltins: false, browser: true }),
    nodePolyfills(),
    terser({ compress: { dead_code: true, passes: 2 } }),
  ];
}

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  treeshake: {
    moduleSideEffects: false,
  },
  input: 'src/conductor/initialise.ts',
  output: {
    file: `dist/${EVALUATOR}.js`,
    format: 'iife',
    name: 'JsSlangWorker',
    sourcemap: true,
    // Node code references bare `global`/`process`; a browser Worker has neither. rollup-plugin-
    // polyfill-node injects shims for *most* references, but misses some inside large bundled CJS
    // deps (e.g. the TypeScript compiler's `process.env.NODE_ENV` checks), which then throw at
    // Worker load. Define safe top-level fallbacks so any un-rewritten references resolve. `global`
    // → globalThis; `process` → a minimal browser-ish process (NODE_ENV=production so dev-only
    // branches are excluded). In Node these fall through to the real globals.
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
