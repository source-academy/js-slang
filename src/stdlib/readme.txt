The docs/ folder is generated with TypeDoc.

Command to generate docs/:

SRC='src/stdlib/'
typedoc --ignoreCompilerErrors --readme none --exclude "$SRC/__tests__/**" --excludeExternals -out "$SRC/docs" "$SRC"
