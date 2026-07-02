// @ts-check

import assert from 'assert'
import fs from 'fs/promises'
import pathlib from 'path'
import { isNativeError } from 'util/types'
import { JSDOM } from 'jsdom'

const CONST_DECL = 'const'
const FUNC_DECL = 'func'

const BASE_DIR = 'docs/source'
const SRC_FILENAME = 'global.html'
const OUT_DIR = 'src/editors/ace/docTooltip'

const TARGETS = [
  "source_1",
  "source_1_wasm",
  "source_1_typed",
  "source_2",
  "source_2_typed",
  "source_3",
  "source_3_typed",
  "source_4",
  "source_4_typed",
  "source_4_explicit-control",
  "External libraries"
]

/**
 * @param {string} title 
 * @param {Document} document 
 */
function newTitleNode(title, document) {
  const node = document.createElement('h4')
  const text = document.createTextNode(title)
  node.appendChild(text)
  return node
}

/**
 * @param {HTMLDivElement} div 
 */
function buildDescriptionHtml(div) {
  return div.outerHTML.replace('/\n+/', '\n')
}

/**
 * @param {Record<string ,any>} namespace 
 * @param {Element} element 
 * @param {Document} document 
 */
function processConstant(namespace, element, document) {
  const header = element.getElementsByTagName('h4')[0]
  const rawName = header.textContent
  const fields = rawName.split(' ').slice(1)

  let title = fields.join('')
  const name = header.getAttribute('id')
  assert(name !== null, `Missing id for ${element}`)

  if (!title) {
    title = name
  }

  const titleNode = newTitleNode(title, document)
  const descriptionNode = element.getElementsByClassName('description')[0]

  const descriptionDiv = document.createElement('div')
  descriptionDiv.appendChild(titleNode)
  descriptionDiv.appendChild(descriptionNode)
  const html = buildDescriptionHtml(descriptionDiv)

  namespace[name] = { title, description: html, meta: CONST_DECL }
}

/**
 * @param {Record<string ,any>} namespace 
 * @param {Element} element 
 * @param {Document} document 
 */
function processFunction(namespace, element, document) {
  const header = element.getElementsByTagName('h4')[0]
  const title = header.textContent
  const name = header.getAttribute('id')
  assert(name !== null, `Missing name for ${element}`)

  const titleNode = newTitleNode(title, document)
  const descriptionNode = element.getElementsByClassName('description')[0]

  const descriptionDiv = document.createElement('div')
  descriptionDiv.appendChild(titleNode)
  descriptionDiv.appendChild(descriptionNode)
  const html = buildDescriptionHtml(descriptionDiv)

  namespace[name] = { title, description: html, meta: FUNC_DECL }
}

/**
 * Process all the globals in the given target directory
 * @param {string} target
 * @returns {Promise<unknown|undefined>}
 */
async function processDirGlobals(target) {
  const inFile = pathlib.join(BASE_DIR, target, SRC_FILENAME)
  let document
  try {
    const contents = await fs.readFile(inFile)
    document = new JSDOM(contents.toString()).window.document
  } catch (err) {
    console.error(inFile, 'failed', err)
    return err
  }

  const names = {}

  const constants = document.getElementsByClassName('constant-entry')
  Array.prototype.forEach.call(constants, ele => processConstant(names, ele, document))

  const functions = document.getElementsByClassName('function-entry')
  Array.prototype.forEach.call(functions, ele => processFunction(names, ele, document))

  const outFile = pathlib.join(OUT_DIR, target + '.json')
  await fs.writeFile(outFile, JSON.stringify(names, null, 2), 'utf-8')
  return undefined
}

/**
 * Generates the autocomplete documentation for js-slang
 */
export default async function autocomplete() {
  try {
    // Check that the BASE_DIR exists and that we can read from it
    await fs.access(BASE_DIR, fs.constants.R_OK)
  } catch (error) {
    if (!isNativeError(error) || !('code' in error)) throw error

    if (error.code === 'ENOENT') {
      console.error(`
      Error: path to jsdoc html is invalid.
      Ensure that this script is run from the project root and documentation has been generated\
      `)
    } else {
      console.error(error)
    }
    process.exit(1)
  }

  await fs.mkdir(OUT_DIR, { recursive: true })

  // Exit with error code if the there was some error
  const errors = await Promise.all(TARGETS.map(processDirGlobals))
  if (errors.find(each => each !== undefined)) process.exit(1)

  console.log('Finished processing autocomplete documentation')
}
