const BACKEND_STATIC_URL = 'http://0.0.0.0:4000/static'
const loadedModules: string[] = []

async function getModuleDirList(): Promise<string[]> {
  return await fetch(`${BACKEND_STATIC_URL}/modules/modules.json`)
    .then(data => data.json())
    .then(obj => {
      if (obj.module_dirs === undefined) {
        throw new Error('Invalid modules.json: key "module_dirs" is missing')
      }
      return obj.module_dirs
    })
}

async function loadModule(
  moduleDirList: string[],
  moduleName: string,
  usedSymbols: string[] = []
): Promise<void> {
  if (loadedModules.includes(moduleName)) {
    return
  }
  const dirname: string | undefined = moduleDirList[moduleName]
  if (dirname === undefined) {
    throw new Error('Unknown module: ' + moduleName)
  }
  loadedModules.push(moduleName)
  const modulePath = `${BACKEND_STATIC_URL}/modules/${dirname}`
  await fetch(modulePath + '/module_config.json')
    .then(data => data.json())
    .then(moduleObj => {
      const sourceFileNames: string[] = moduleObj.module_source_files
      const allSymbols: string[] = moduleObj.module_symbols
      for (const url of sourceFileNames) {
        dynamicallyLoadScript(modulePath + '/' + url)
        blockUnusedSymbols(allSymbols, usedSymbols)
      }
    })
}

function dynamicallyLoadScript(url: string) {
  // private
  const script = document.createElement('script')
  script.src = url
  script.async = false
  script.defer = true
  document.body.appendChild(script)
}

function blockUnusedSymbols(allSymbols: string[], usedSymbols: string[]) {
  const unusedSymbols = allSymbols.filter(x => !usedSymbols.includes(x))
  let scriptText = ''
  for (const symbol of unusedSymbols) {
    scriptText += `${symbol} = undefined;\n`
  }
  const script = document.createElement('script')
  script.text = scriptText
  script.async = false
  document.body.appendChild(script)
}

export async function loadModuleByName(name: string, usedSymbols: string[]) {
  await getModuleDirList().then(moduleDirList => {
    loadModule(moduleDirList, name, usedSymbols)
  })
}
