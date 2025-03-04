// @ts-check

import { execFile, fork, spawn } from 'child_process'
import pathlib from 'path'
import fs from 'fs/promises'
import { Command } from 'commander'
import process from 'process'
import autocomplete from './autocomplete.mjs'

const configs = {
  "landing": {
    "readme": "README_top.md",
    "dst": "",
    "libs": [
      "empty.js"
    ]
  },
  "Source §1": {
    "readme": "README_1.md",
    "dst": "source_1/",
    "libs": [
      "misc.js",
      "math.js"
    ]
  },
  "Source §1 Typed": {
    "readme": "README_1_TYPED.md",
    "dst": "source_1_typed/",
    "libs": [
      "misc.js",
      "math.js"
    ]
  },
  "Source §1 WebAssembly": {
    "readme": "README_1_WASM.md",
    "dst": "source_1_wasm/",
    "libs": [
      "empty.js"
    ]
  },
  "Source §2": {
    "readme": "README_2.md",
    "dst": "source_2/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js"
    ]
  },
  "Source §2 Typed": {
    "readme": "README_2_TYPED.md",
    "dst": "source_2_typed/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js"
    ]
  },
  "Source §3": {
    "readme": "README_3.md",
    "dst": "source_3/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js",
      "stream.js",
      "array.js",
      "pairmutator.js"
    ]
  },
  "Source §3 Concurrent": {
    "readme": "README_3_CONCURRENT.md",
    "dst": "source_3_concurrent/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js",
      "stream.js",
      "array.js",
      "pairmutator.js",
      "concurrency.js"
    ]
  },
  "Source §3 Typed": {
    "readme": "README_3_TYPED.md",
    "dst": "source_3_typed/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js",
      "stream.js",
      "array.js",
      "pairmutator.js"
    ]
  },
  "Source §4": {
    "readme": "README_4.md",
    "dst": "source_4/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js",
      "stream.js",
      "array.js",
      "pairmutator.js",
      "mce.js"
    ]
  },
  "Source §4 Explicit-Control": {
    "readme": "README_4_EXPLICIT-CONTROL.md",
    "dst": "source_4_explicit-control/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js",
      "stream.js",
      "array.js",
      "pairmutator.js",
      "mce.js",
      "continuation.js"
    ]
  },
  "Source §4 Typed": {
    "readme": "README_4_TYPED.md",
    "dst": "source_4_typed/",
    "libs": [
      "auxiliary.js",
      "misc.js",
      "math.js",
      "list.js",
      "stream.js",
      "array.js",
      "pairmutator.js",
      "mce.js"
    ]
  },
  "AUXILLARY": {
    "readme": "README_AUXILIARY.md",
    "dst": "AUXILIARY/",
    "libs": [
      "auxiliary.js"
    ]
  },
  "MISC": {
    "readme": "README_MISC.md",
    "dst": "MISC/",
    "libs": [
      "misc.js"
    ]
  },
  "MATH": {
    "readme": "README_MATH.md",
    "dst": "MATH/",
    "libs": [
      "math.js"
    ]
  },
  "LIST": {
    "readme": "README_LISTS.md",
    "dst": "LISTS/",
    "libs": [
      "list.js"
    ]
  },
  "STREAMS": {
    "readme": "README_STREAMS.md",
    "dst": "STREAMS/",
    "libs": [
      "stream.js"
    ]
  },
  "ARRAYS": {
    "readme": "README_ARRAYS.md",
    "dst": "ARRAYS/",
    "libs": [
      "array.js"
    ]
  },
  "PAIRMUTATIONS": {
    "readme": "README_PAIRMUTATORS.md",
    "dst": "PAIRMUTATORS/",
    "libs": [
      "pairmutator.js"
    ]
  },
  "CONCURRENCY": {
    "readme": "README_CONCURRENCY.md",
    "dst": "CONCURRENCY/",
    "libs": [
      "concurrency.js"
    ]
  },
  "MCE": {
    "readme": "README_MCE.md",
    "dst": "MCE/",
    "libs": [
      "mce.js"
    ]
  },
  "CONTINUATION": {
    "readme": "README_CONTINUATION.md",
    "dst": "CONTINUATION/",
    "libs": [
      "continuation.js"
    ]
  },
  "EV3": {
    "readme": "EV3_README.md",
    "dst": "EV3/",
    "libs": [
      "ev3.js"
    ]
  },
  "EXTERNAL": {
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
const jsdoc = "node_modules/jsdoc/jsdoc.js"
const template_location = "docs/jsdoc/templates/template"
const specs_dir = "docs/specs"

async function run() {
  await fs.mkdir(out_dir, { recursive: true })

  const promises = Object.entries(configs).map(([name, config]) => {
    // Use fork to start a new instance of nodejs and run jsdoc
    // for each configuration
    const proc = fork(jsdoc, [
      '-r',
      '-t', template_location,
      '-c', config_file,
      '-R', pathlib.join(readmes, config.readme),
      '-d', pathlib.join(out_dir, config.dst),
      ...config.libs.map(each => pathlib.join(libraries, each))
    ])

    proc.on('spawn', () => console.log(`Building ${name}`))
    return new Promise(resolve => {
      proc.on('exit', c => {
        if (c === 0) {
          console.log(`Finished ${name}`)
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
}

async function prepare({ silent }) {
  await run()

  // Copy images in images directory to out_dir
  await fs.readdir('docs/images')
    .then(images => Promise.all(images.map(async img => {
      const srcPath = pathlib.join('docs/images', img)
      const dstPath = pathlib.join(out_dir, img)
      await fs.copyFile(srcPath, dstPath)
      console.debug(`Copied ${srcPath} to ${dstPath}`)
    })))

  const makeProc = spawn('make', { cwd: specs_dir, stdio: [
    'ignore',
    silent ? 'ignore' : 'inherit',
    'inherit'
  ]})

  const makeretcode = await new Promise(resolve => {
    makeProc.on('exit', resolve)
    makeProc.on('error', e => {
      console.error('Failed to start make: ', e)
      process.exit(1)
    })
  })

  if (makeretcode !== 0) process.exit(makeretcode)
  console.log('Finished running make')

  // Copy pdf files that make produced to out_dir
  await fs.readdir(specs_dir)
    .then(files => Promise.all(files
      .filter(file => pathlib.extname(file) === '.pdf')
      .map(async file => {
        const srcPath = pathlib.join(specs_dir, file)
        const dstPath = pathlib.join(out_dir, file)
        await fs.copyFile(srcPath, dstPath)
        console.debug(`Copied ${srcPath} to ${dstPath}`)
      })
    ))
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
  })})

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
      .action(run),
    { isDefault: true }
  )
  .addCommand(
    new Command('prepare')
      .option('--silent', 'Run make without outputting to stdout')
      .action(prepare)
  )
  .addCommand(
    new Command('clean')
      .description('Clear the output directory')
      .action(clean)
  )
  .addCommand(
    new Command('autocomplete')
      .description('Update autocomplete documentation')
      .action(autocomplete)
  )
  .addCommand(
    new Command('docs')
      .description('Execute the \'run\' command and then the \'autocomplete\' command')
      .action(() => run().then(autocomplete))
  )
  .parseAsync()
  