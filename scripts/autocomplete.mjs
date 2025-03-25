// @ts-check

import fs from 'fs/promises'
import pathlib from 'path'
import { JSDOM } from 'jsdom'

const CONST_DECL = 'const'
const FUNC_DECL = 'func'

const BASE_DIR = 'docs/source'
const SRC_FILENAME = 'global.html'
const OUT_DIR = 'src/editors/ace/docTooltip'

const TARGETS = [
  'source_1',
  'source_1_wasm',
  'source_1_typed',
  'source_2',
  'source_2_typed',
  'source_3',
  'source_3_concurrent',
  'source_3_typed',
  'source_4',
  'source_4_typed',
  'source_4_explicit-control',
  'External libraries'
]

function newTitleNode(title, document) {
  const node = document.createElement('h4')
  const text = document.createTextNode(title)
  node.appendChild(text)
  return node
}

function buildDescriptionHtml(div) {
  return div.outerHTML.replace('/\n+/', '\n')
}

function processConstant(namespace, element, document) {
  const header = element.getElementsByTagName('h4')[0]
  const rawName = header.textContent
  const fields = rawName.split(' ').slice(1)

  let title = fields.join('')
  const name = header.getAttribute('id')
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

function processFunction(namespace, element, document) {
  const header = element.getElementsByTagName('h4')[0]
  const title = header.textContent
  const name = header.getAttribute('id')

  const titleNode = newTitleNode(title, document)
  const descriptionNode = element.getElementsByClassName('description')[0]

  const descriptionDiv = document.createElement('div')
  descriptionDiv.appendChild(titleNode)
  descriptionDiv.appendChild(descriptionNode)
  const html = buildDescriptionHtml(descriptionDiv)

  namespace[name] = { title, description: html, meta: FUNC_DECL }
}

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

export default async function autocomplete() {
  try {
    // Check that the BASE_DIR exists and that we can read from it
    await fs.access(BASE_DIR, fs.constants.R_OK)
  } catch (error) {
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
