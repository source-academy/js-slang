export const accessExportFunctionName = '__access_export__'

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
  const named_exports = tail(exports);
  return __access_named_export__(named_exports, lookup_name);
}
`
