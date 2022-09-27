#! /bin/bash

SICPJSPATH=sicp_publish/dist/sicp.js

main() {
    clean
    yarn build
    prepare
    node dist/sicp-prepare.js
    write
}

clean() {
    # Prepare to write sicp_publish/dist/sicp.js again
    rm -f sicp_publish/prelude.txt
    rm -f sicp_publish/names.txt
}

prepare() {
    # Copy and keep only necessary files
    rm -rf sicp_publish/dist
    cp -r dist sicp_publish
    mkdir -p sicp_publish/dist
    cd sicp_publish/dist
    find . -type f ! -name '*.js' -delete

    # Remove unnecessary dependencies
    rm -r __tests__
    rm finder.js index.js scope-refactoring.js sicp-prepare.js
    cd ../..
}

write() {
    echo "\"use strict\";" >> $SICPJSPATH
    echo "Object.defineProperty(exports, \"__esModule\", { value: true });" >> $SICPJSPATH
    echo "const createContext_1 = require(\"./createContext\");" >> $SICPJSPATH
    echo "const dict = createContext_1.default(4).nativeStorage.builtins;" >> $SICPJSPATH

    echo $'\n// Declare functions for prelude\n' >> $SICPJSPATH
    while read -r CURRENT_LINE
    do 
        if [ "$CURRENT_LINE" != "undefined" -a "$CURRENT_LINE" != "NaN" -a "$CURRENT_LINE" != "Infinity" ]
        then
            echo "const $CURRENT_LINE = dict.get(\"$CURRENT_LINE\");" >> $SICPJSPATH
        fi
    done < "sicp_publish/names.txt"

    echo $'\n// Prelude' >> $SICPJSPATH    
    cat sicp_publish/prelude.txt >> $SICPJSPATH

    echo $'\n// Write prelude names\n' >> $SICPJSPATH
    while read -r CURRENT_LINE
    do 
        echo "exports.$CURRENT_LINE = $CURRENT_LINE;" >> $SICPJSPATH
    done < "sicp_publish/prelude_names.txt"

    echo $'\n// Write functions\n' >> $SICPJSPATH
    
    while read -r CURRENT_LINE
    do 
        if [ "$CURRENT_LINE" != "undefined" -a "$CURRENT_LINE" != "NaN" -a "$CURRENT_LINE" != "Infinity" ]
        then
            echo "exports.$CURRENT_LINE = dict.get(\"$CURRENT_LINE\");" >> $SICPJSPATH
        fi
    done < "sicp_publish/names.txt"
}

main
