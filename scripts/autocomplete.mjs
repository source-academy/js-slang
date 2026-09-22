// @ts-check

/**
 * Generates the autocomplete builtin data the Conductor evaluators' AutoCompletePlugin ships —
 * one JSON file per `docs/lib/*.js` source, written to
 * `src/conductor/plugins/autocomplete/builtins/`.
 *
 * `docs/lib/*.js` is the single source of truth: the same jsdoc-annotated stub functions `yarn
 * jsdoc` already renders into the published language documentation. This script asks jsdoc for
 * its own parsed doclet AST directly (`-X`, jsdoc's "explain" mode) rather than scraping the
 * *rendered* HTML the way the pre-Conductor pipeline did (`git show <pre-#2070>:scripts/autocomplete.mjs`)
 * — that scrape only worked after `yarn docs` had already run, a build-order dependency that broke
 * CI once already (#2068). `-X` is a pure parse step with no such ordering requirement.
 *
 * Output is committed (like py-slang's `builtins/*.json`), so a clean `yarn build:evaluators`
 * doesn't need this script to have run first — but it should be re-run (this script) whenever
 * `docs/lib/*.js` changes, and CI checks the output is up to date (see `nodejs.yml`).
 */

import { execFile } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import pathlib from 'path'
import { fileURLToPath } from 'url'

const __dirname = pathlib.dirname(fileURLToPath(import.meta.url))
const repoRoot = pathlib.join(__dirname, '..')

/** Every `docs/lib/*.js` file that's part of Source §1-4's own builtin surface — not `auxiliary.js`
 * (internal `__access_export__`-style module-loader plumbing, never student-facing),
 * `continuation.js` (§4 Explicit-Control only, which has no Conductor evaluator yet — #2054), or
 * `ev3.js`/`parsetreetypes.js`/`empty.js` (EV3 hardware and jsdoc scaffolding, not part of any
 * Source chapter). Order matches `scripts/docs.mjs`'s own per-chapter `libs` lists. */
const libFiles = ['misc.js', 'math.js', 'list.js', 'stream.js', 'array.js', 'pairmutator.js', 'mce.js']

const libDir = pathlib.join(repoRoot, 'docs/lib')
const confFile = pathlib.join(repoRoot, 'docs/jsdoc/conf.json')
const jsdocBin = pathlib.join(repoRoot, 'node_modules/jsdoc/jsdoc.js')
const outDir = pathlib.join(repoRoot, 'src/conductor/plugins/autocomplete/builtins')

/** One doclet from jsdoc's `-X` AST dump. Only the shapes this script actually reads are typed;
 * jsdoc emits several other `kind`s (`package`, `member`, ...) this script filters out. */
/**
 * @typedef {{
 *   kind: 'function',
 *   scope: string,
 *   name: string,
 *   description?: string,
 *   params?: { name: string }[],
 *   returns?: { type?: { names: string[] } }[],
 * } | {
 *   kind: 'constant',
 *   scope: string,
 *   name: string,
 *   description?: string,
 * } | {
 *   kind: string,
 *   scope?: string,
 * }} Doclet
 */

/**
 * @typedef {{ name: string, title: string, description: string, meta: 'func' | 'var' }} AutocompleteEntry
 */

/** @param {string} file @returns {Promise<Doclet[]>} */
function runJsdocExplain(file) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [jsdocBin, '-X', '-c', confFile, pathlib.join(libDir, file)],
      { maxBuffer: 1024 * 1024 * 16 },
      (error, stdout) => {
        if (error) {
          reject(new Error(`jsdoc -X failed on ${file}: ${error.message}`))
          return
        }
        resolve(JSON.parse(stdout))
      },
    )
  })
}

/** @param {Doclet} doclet @returns {AutocompleteEntry | null} */
function toEntry(doclet) {
  if (doclet.scope !== 'global') return null
  // Undocumented: every genuine, student-facing builtin in docs/lib has a jsdoc comment above it
  // by convention. What's left without one is internal plumbing local to the doc-mirror file
  // itself - e.g. list.js's own $accumulate/$append/$build_list helpers, which the actual
  // accumulate/append/build_list wrap - never meant to be autocomplete-visible.
  if (!('description' in doclet) || !doclet.description) return null
  if (doclet.kind === 'function') {
    const params = doclet.params ?? []
    const returnType = doclet.returns?.[0]?.type?.names?.[0] ?? 'undefined'
    return {
      name: doclet.name,
      title: `${doclet.name}(${params.map(p => p.name).join(', ')}) -> ${returnType}`,
      description: doclet.description ?? '',
      meta: 'func',
    }
  }
  if (doclet.kind === 'constant') {
    return {
      name: doclet.name,
      title: doclet.name,
      description: doclet.description ?? '',
      meta: 'var',
    }
  }
  return null
}

async function run() {
  for (const file of libFiles) {
    const doclets = await runJsdocExplain(file)
    /** @type {AutocompleteEntry[]} */
    const entries = []
    for (const doclet of doclets) {
      const entry = toEntry(doclet)
      if (entry) entries.push(entry)
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))

    const outFile = pathlib.join(outDir, `${pathlib.basename(file, '.js')}.json`)
    const json = JSON.stringify(entries, null, 2) + '\n'
    // Skip the write when content is unchanged, so a routine `yarn autocomplete` run doesn't
    // dirty the tree (and its mtime) on every invocation - only a real content change should.
    const existing = await readFile(outFile, 'utf8').catch(() => null)
    if (existing !== json) {
      await writeFile(outFile, json)
      console.log(`Wrote ${pathlib.relative(repoRoot, outFile)} (${entries.length} entries)`)
    } else {
      console.log(`${pathlib.relative(repoRoot, outFile)} already up to date`)
    }
  }
}

await run()
