import * as ext_lib from './External libraries.json'
import * as source_1 from './source_1.json'
import * as source_1_typed from './source_1_typed.json'
import * as source_2 from './source_2.json'
import * as source_2_typed from './source_2_typed.json'
import * as source_3 from './source_3.json'
import * as source_3_concurrent from './source_3_concurrent.json'
import * as source_3_non_det from './source_3_non-det.json'
import * as source_3_typed from './source_3_typed.json'
import * as source_4 from './source_4.json'
import * as source_4_typed from './source_4_typed.json'

// (18 March 2022)
// Problem to be fixed in the future:
//
// There seems to be an inconsistency between how jest and how typescript
// behaves when encountering imports of the form `import * as x from 'x.json'`
// jest will set x = jsonobject,
// but typescript will instead set x = { default: jsonobject }
//
// This means that under typescript, we want `import x from 'x.json'`,
// while under jest, we want `import * as x from 'x.json'`
//
// This problem was hidden when transpiling to CommonJS modules before, which
// behaves similarly to jest. But now that we are transpiling to es6,
// typescript projects that depend on js-slang may now be exposed to this
// inconsistency.
//
// For now, we use brute force until the landscape changes or someone thinks of
// a proper solution.
function resolveImportInconsistency(json: any) {
  // `json` doesn't inherit from `Object`?
  // Can't use hasOwnProperty for some reason.
  if ('default' in json) {
    return json.default
  } else {
    return json
  }
}

export const SourceDocumentation = {
  builtins: {
    '1': resolveImportInconsistency(source_1),
    '1_lazy': resolveImportInconsistency(source_1),
    '1_typed': resolveImportInconsistency(source_1_typed),
    '2': resolveImportInconsistency(source_2),
    '2_lazy': resolveImportInconsistency(source_2),
    '2_typed': resolveImportInconsistency(source_2_typed),
    '3': resolveImportInconsistency(source_3),
    '3_concurrent': resolveImportInconsistency(source_3_concurrent),
    '3_non-det': resolveImportInconsistency(source_3_non_det),
    '3_typed': resolveImportInconsistency(source_3_typed),
    '4': resolveImportInconsistency(source_4),
    '4_typed': resolveImportInconsistency(source_4_typed)
  },
  ext_lib
}
