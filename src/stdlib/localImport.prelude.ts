export const accessExportFunctionName = '__access_export__'
// We can make use of 'default' to denote that the default export
// should be accessed because 'default' is a reserved keyword in
// Source. Specifically, the Acorn parser does not allow 'default'
// to be used as a name.
export const defaultExportLookupName = 'default'

export const localImportPrelude = `
function __access_named_export__(named_exports, lookup_name) {
  if (is_null(named_exports)) {
    return undefined;
  } else {
    const name = head(head(named_exports));
    const identifier = tail(head(named_exports));
    if (name === lookup_name) {
      return identifier;
    } else {
      return __access_named_export__(tail(named_exports), lookup_name);
    }
  }
}

function ${accessExportFunctionName}(exports, lookup_name) {
  if (lookup_name === "${defaultExportLookupName}") {
    return head(exports);
  } else {
    const named_exports = tail(exports);
    return __access_named_export__(named_exports, lookup_name);
  }
}
`
