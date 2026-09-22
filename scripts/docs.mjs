// @ts-check

import { execFile, fork, spawn } from 'child_process'
import pathlib from 'path'
import fs from 'fs/promises'
import process from 'process'
import { Command } from '@commander-js/extra-typings'

const configs = {
  landing: {
    readme: 'README_top.md',
    dst: '',
    libs: ['empty.js']
  },
  // "Source §N" below is kept only so the historical source_N/ URLs keep resolving; its readme
  // is shared with "JavaScript §N" (see javascript_N.tex's docs/specs analogue), so its own
  // content already reads "JavaScript §N" - only the folder name (and thus this generated page's
  // auto-derived title, see publish.js) stays on the old name. "JavaScript §N" is the real,
  // renamed entry point and should be used for any new reference.
  'Source §1': {
    readme: 'README_1.md',
    dst: 'source_1/',
    libs: ['misc.js', 'math.js']
  },
  'JavaScript §1': {
    readme: 'README_1.md',
    dst: 'javascript_1/',
    libs: ['misc.js', 'math.js']
  },
  'Source §1 Typed': {
    readme: 'README_1_TYPED.md',
    dst: 'source_1_typed/',
    libs: ['misc.js', 'math.js']
  },
  'JavaScript §1 Typed': {
    readme: 'README_1_TYPED.md',
    dst: 'javascript_1_typed/',
    libs: ['misc.js', 'math.js']
  },
  'Source §1 WebAssembly': {
    readme: 'README_1_WASM.md',
    dst: 'source_1_wasm/',
    libs: ['empty.js']
  },
  'JavaScript §1 WebAssembly': {
    readme: 'README_1_WASM.md',
    dst: 'javascript_1_wasm/',
    libs: ['empty.js']
  },
  'Source §2': {
    readme: 'README_2.md',
    dst: 'source_2/',
    libs: ['auxiliary.js', 'misc.js', 'math.js', 'list.js']
  },
  'JavaScript §2': {
    readme: 'README_2.md',
    dst: 'javascript_2/',
    libs: ['auxiliary.js', 'misc.js', 'math.js', 'list.js']
  },
  'Source §2 Typed': {
    readme: 'README_2_TYPED.md',
    dst: 'source_2_typed/',
    libs: ['auxiliary.js', 'misc.js', 'math.js', 'list.js']
  },
  'JavaScript §2 Typed': {
    readme: 'README_2_TYPED.md',
    dst: 'javascript_2_typed/',
    libs: ['auxiliary.js', 'misc.js', 'math.js', 'list.js']
  },
  'Source §3': {
    readme: 'README_3.md',
    dst: 'source_3/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'timing.js'
    ]
  },
  'JavaScript §3': {
    readme: 'README_3.md',
    dst: 'javascript_3/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js'
    ]
  },
  'Source §3 Typed': {
    readme: 'README_3_TYPED.md',
    dst: 'source_3_typed/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js'
    ]
  },
  'JavaScript §3 Typed': {
    readme: 'README_3_TYPED.md',
    dst: 'javascript_3_typed/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js'
    ]
  },
  'Source §4': {
    readme: 'README_4.md',
    dst: 'source_4/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'timing.js',
      'mce.js'
    ]
  },
  'JavaScript §4': {
    readme: 'README_4.md',
    dst: 'javascript_4/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'mce.js'
    ]
  },
  'Source §4 Explicit-Control': {
    readme: 'README_4_EXPLICIT-CONTROL.md',
    dst: 'source_4_explicit-control/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'mce.js',
      'continuation.js'
    ]
  },
  'JavaScript §4 Explicit-Control': {
    readme: 'README_4_EXPLICIT-CONTROL.md',
    dst: 'javascript_4_explicit-control/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'mce.js',
      'continuation.js'
    ]
  },
  'Source §4 Typed': {
    readme: 'README_4_TYPED.md',
    dst: 'source_4_typed/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'mce.js'
    ]
  },
  'JavaScript §4 Typed': {
    readme: 'README_4_TYPED.md',
    dst: 'javascript_4_typed/',
    libs: [
      'auxiliary.js',
      'misc.js',
      'math.js',
      'list.js',
      'stream.js',
      'array.js',
      'pairmutator.js',
      'mce.js'
    ]
  },
  AUXILIARY: {
    readme: 'README_AUXILIARY.md',
    dst: 'AUXILIARY/',
    libs: ['auxiliary.js']
  },
  MATH: {
    readme: 'README_MATH.md',
    dst: 'MATH/',
    libs: ['math.js']
  },
  MISC: {
    readme: 'README_MISC.md',
    dst: 'MISC/',
    libs: ['misc.js']
  },
  LIST: {
    readme: 'README_LISTS.md',
    dst: 'LISTS/',
    libs: ['list.js']
  },
  STREAMS: {
    readme: 'README_STREAMS.md',
    dst: 'STREAMS/',
    libs: ['stream.js']
  },
  ARRAYS: {
    readme: 'README_ARRAYS.md',
    dst: 'ARRAYS/',
    libs: ['array.js']
  },
  PAIRMUTATORS: {
    readme: 'README_PAIRMUTATORS.md',
    dst: 'PAIRMUTATORS/',
    libs: ['pairmutator.js']
  },
  MCE: {
    readme: 'README_MCE.md',
    dst: 'MCE/',
    libs: ['mce.js']
  },
  CONTINUATION: {
    readme: 'README_CONTINUATION.md',
    dst: 'CONTINUATION/',
    libs: ['continuation.js']
  },
  EV3: {
    readme: 'EV3_README.md',
    dst: 'EV3/',
    libs: ['ev3.js']
  },
  EXTERNAL: {
    "readme": "README_EXTERNAL.md",
    "dst": "External libraries",
    "libs": [
      "ev3.js"
    ]
  }
}

const config_file = 'docs/jsdoc/conf.json'
const readmes = 'docs/md'
const libraries = 'docs/lib'
const out_dir = 'docs/source'
const jsdoc = 'node_modules/jsdoc/jsdoc.js'
const template_location = 'docs/jsdoc/templates/template'
const specs_dir = 'docs/specs'

/**
 * Build the documentations using JSDOC
 * @param {boolean | undefined} silent 
 */
async function run(silent) {
  await fs.mkdir(out_dir, { recursive: true })

  const promises = Object.entries(configs).map(([name, config]) => {
    // Use fork to start a new instance of nodejs and run jsdoc
    // for each configuration
    const proc = fork(jsdoc, [
      '-r',
      '-t',
      template_location,
      '-c',
      config_file,
      '-R',
      pathlib.join(readmes, config.readme),
      '-d',
      pathlib.join(out_dir, config.dst),
      ...config.libs.map(each => pathlib.join(libraries, each))
    ])

    if (!silent) {
      proc.on('spawn', () => console.log(`Building ${name}`))
    }

    return new Promise(resolve => {
      proc.on('exit', c => {
        if (c === 0) {
          if (!silent) console.log(`Finished ${name}`)
        } else {
          console.error(`Error occurred with ${name}: jsdoc exited with code ${c}`)
        }
        resolve(c)
      })

      proc.on('error', e => {
        console.error(`Error occurred with ${name}: `, e)
        resolve(1)
      })
    })
  })

  // If some instance returned a non zero return code,
  // exit with that return code
  const retcodes = await Promise.all(promises)
  const nonzeroRetcode = retcodes.find(c => c !== 0)

  if (nonzeroRetcode !== undefined) process.exit(nonzeroRetcode)

  await patchLandingPageHeadline(silent)
  await patchOldChapterFolderHeadings(silent)
}

/**
 * The landing page's own <title>/<h1> aren't sourced from README_top.md - the template
 * (publish.js) derives them from `path.basename(outdir)`, which for the landing config (`dst:
 * ''`) is always the literal local directory name "source", regardless of where this later gets
 * deployed (see deploy-docs.yml's /javascript destination_dir). jsdoc has no CLI option to
 * override this (`--mainpagetitle` looks like one in the template but isn't a real registered
 * flag - confirmed it makes jsdoc itself fail with "Unknown command-line option"), so this patches
 * the two known auto-generated strings directly after the build, rather than fighting the
 * template's plugin API for one page.
 * @param {boolean | undefined} silent
 */
async function patchLandingPageHeadline(silent) {
  const headline = 'JavaScript sublanguages for SICP JS'
  const indexPath = pathlib.join(out_dir, configs.landing.dst, 'index.html')
  const html = await fs.readFile(indexPath, 'utf8')
  const patched = html
    .replace('<title>Source</title>', `<title>${headline}</title>`)
    .replace(
      '<h1 class="page-title">Source</h1>',
      `<h1 class="page-title">${headline}</h1>`,
    )
  if (patched === html) {
    console.error(
      `Expected to find the auto-generated "Source" headline in ${indexPath} to patch - the ` +
        'template must have changed.',
    )
    process.exit(1)
  }
  await fs.writeFile(indexPath, patched)
  if (!silent) console.log(`Patched landing page headline in ${indexPath}`)
}

/**
 * The old source_1../4/ folders (kept only so their historical URLs keep resolving) share their
 * READMEs with the new javascript_1../4/ folders, so their own body content already reads
 * "JavaScript §N" - only the same folder-name-derived headings patchLandingPageHeadline works
 * around (index.html's <title>/<h1>, global.html's "Predeclared in ...") still read "Source §N",
 * inconsistent with the rest of each page. Every occurrence of the literal phrase "Source §N" in
 * these folders' generated .html files is one of those headings - verified by grepping a build for
 * "Source" once every body sentence was already renamed - so a plain string replace across every
 * .html file in each folder is safe, without needing to know exactly which files or how many the
 * template produces (global.html, index.html, ... - the same libs won't necessarily produce the
 * same set of pages if docs/lib content changes later).
 * @param {boolean | undefined} silent
 */
async function patchOldChapterFolderHeadings(silent) {
  for (const n of [1, 2, 3, 4]) {
    const dir = pathlib.join(out_dir, `source_${n}`)
    const from = `Source §${n}`
    const to = `JavaScript §${n}`
    const files = await fs.readdir(dir)
    for (const file of files) {
      if (!file.endsWith('.html')) continue
      const filePath = pathlib.join(dir, file)
      const html = await fs.readFile(filePath, 'utf8')
      const patched = html.replaceAll(from, to)
      if (patched !== html) {
        await fs.writeFile(filePath, patched)
        if (!silent) console.log(`Patched heading in ${filePath}`)
      }
    }
  }
}

/**
 * Runs JSDOC, then `make`
 * @param {boolean | undefined} silent 
 */
async function prepare(silent) {
  await run(silent)

  // Copy images in images directory to out_dir
  await fs.readdir('docs/images').then(images =>
    Promise.all(
      images.map(async img => {
        const srcPath = pathlib.join('docs/images', img)
        const dstPath = pathlib.join(out_dir, img)
        await fs.copyFile(srcPath, dstPath)
        if (!silent) console.log(`Copied ${srcPath} to ${dstPath}`)
      })
    )
  )

  const makeProc = spawn('make', {
    cwd: specs_dir,
    stdio: ['ignore', silent ? 'ignore' : 'inherit', 'inherit']
  })

  const makeretcode = await new Promise(resolve => {
    makeProc.on('exit', resolve)
    makeProc.on('error', e => {
      console.error('Failed to start make: ', e)
      process.exit(1)
    })
  })

  if (makeretcode !== 0) process.exit(makeretcode)
  if (!silent) console.log('Finished running make')

  // Copy pdf files that make produced to out_dir
  await fs.readdir(specs_dir).then(files =>
    Promise.all(
      files
        .filter(file => pathlib.extname(file) === '.pdf')
        .map(async file => {
          const srcPath = pathlib.join(specs_dir, file)
          const dstPath = pathlib.join(out_dir, file)
          await fs.copyFile(srcPath, dstPath)
          if (!silent) console.debug(`Copied ${srcPath} to ${dstPath}`)
        })
    )
  )
}

async function clean() {
  await fs.rm(out_dir, { recursive: true })
  console.log(`Cleared ${out_dir}`)
}

/**
 * Check that the commands are being run from the root of the git repository
 */
async function checkGitRoot() {
  const gitRoot = await new Promise(resolve => {
    execFile('git', ['rev-parse', '--show-toplevel'], (err, stdout, stderr) => {
      const possibleError = err || stderr
      if (possibleError) {
        console.error(possibleError)
        process.exit(1)
      }

      resolve(stdout.trim())
    })
  })

  const procDir = pathlib.relative(gitRoot, '')
  if (procDir !== '') {
    console.error('Please run this command from the git root directory')
    process.exit(1)
  }
}

await new Command()
  .hook('preAction', checkGitRoot)
  .addCommand(
    new Command('run')
      .description('Run JSDOC and build documentation')
      .option('--silent', 'Run without outputting to stdout')
      .action(args => run(args.silent)), { isDefault: true }
  )
  .addCommand(
    new Command('prepare')
      .option('--silent', 'Run make without outputting to stdout')
      .action(args => prepare(args.silent))
  )
  .addCommand(new Command('clean').description('Clear the output directory').action(clean))
  // The `autocomplete` and `docs` subcommands are gone with #2070: both existed only to
  // regenerate src/editors/ace/docTooltip, the Ace editor tooltip data the frontend used to
  // import, and that directory no longer exists. What remains here builds the *language*
  // documentation published to docs.sourceacademy.org, which is unrelated to running Source.
  .parseAsync()
