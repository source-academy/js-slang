/*

Custom jest resolver that handles module resolution during tests.
Because the Source module loader is using `import()`, jest actually tries
to find the actual modules on disk. But the modules we are trying to import 
don't exist on disk, and their specifiers have query parameters attached to them
We need to tell jest that they resolve to the same virtual modules that 
we provide using `jest.mock`.

For example: `http://source-academy.github.io/modules.json?q=1708065474151` gets resolved to
`mockModules/modules.json` which is then provided by 
```
jest.mock('mockModules/modules.json', () => ({
  ...module stuff
 virtual: true })
```

More info here: https://jestjs.io/docs/configuration#resolver-string 
*/
module.exports = function(path, opts) {
  const result = /^http:\/\/source-academy\.github\.io\/modules\/(.+?)(?:\?q=.+)?$/.exec(path)
  if (result === null) {
    return opts.defaultResolver(path, opts)
  }

  return `mockModules/${result[1]}`
  // return opts.defaultResolver(`mockModules/${result[1]}`, opts)
}