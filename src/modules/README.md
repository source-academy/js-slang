# Modules Terminology

A "module" in the context of a Source program refers to two kinds of modules: 'local' and 'source' modules, analagous to how in regular Javascript
there are local and node modules.

The `loaders` folder contains most of the code for loading Source modules, while the preprocessor mainly handles loading local modules.

## Loading Source Bundles

Loading Source Bundles is a two step process:

1. **Importer** retrieves the raw Javascript and returns a partially loaded bundle
2. **Loader** sends the current context to the partially loaded bundle and returns the fully loaded bundle

### Importers

Since Source Modules are a subset of ESM Javascript Modules, we can use the underlying Javascript engine to load them (at least partially). There are several ways
Javascript can be "imported" depending on which module system the engine is currently using:

1. Regular NodeJS is still very much dependent on CommonJS, so even ESM modules are loaded using the `require` syntax. Hence if it is detected that `js-slang`
is not running in a browser environment, we must swap to calling `require`.

1. In the browser, `import` is the ESM way to load modules. Since the browser likes to cache imported Javascript files, we add a query parameter that doesn't do
anything to the loading process, but causes the browser not to cache the imported modules. This behaviour allows us to manually control the caching and refresh
the modules when we choose (e.g. when a new version becomes available).

1. During testing, Vitest allows for ESM syntax, but for our mocked imports to be stable, the query parameter is not attached.