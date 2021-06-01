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
    cd sicp_publish/dist
    find . -type f ! -name '*.js' -delete
    rm -r __tests__ editors lazy mocks name-extractor repl stepper validator vm
    rm finder.js index.js scope-refactoring.js sicp-prepare.js
    cd ../..
}

write() {
    echo "\"use strict\";" >> $SICPJSPATH
    echo "Object.defineProperty(exports, \"__esModule\", { value: true });" >> $SICPJSPATH
    echo "const createContext_1 = require(\"./createContext\");" >> $SICPJSPATH
    echo "createContext_1.default(4);" >> $SICPJSPATH
    echo "const dict = createContext_1.dict;" >> $SICPJSPATH

    cat sicp_publish/prelude.txt >> $SICPJSPATH

    # Write Prelude
    COUNT=0

    while read -r CURRENT_LINE
    do 
        IFS=' ' read -r -a array <<< "$CURRENT_LINE"

        if [ "${array[0]}" == "function" ]
        then
            if [ $COUNT -le 0 ]
            then
                IFS='(' read -r -a name <<< "${array[1]}"
                echo "global.${name[0]} = ${name[0]};" >> $SICPJSPATH
            fi
        fi

        if [ ${#array[@]} != 0 ]
        then
            if [ "${array[${#array[@]} - 1]}" == "{" ]
            then 
            ((COUNT++))
            fi
        fi

        if [ "${array[0]}" == "}" ]
        then
            ((COUNT--))
        fi
    done < "sicp_publish/prelude.txt"

    #Write Functions
    while read -r CURRENT_LINE
    do 
        if [ "$CURRENT_LINE" != "undefined" -a "$CURRENT_LINE" != "NaN" -a "$CURRENT_LINE" != "Infinity" ]
        then
            echo "global.$CURRENT_LINE = dict[\"$CURRENT_LINE\"];" >> $SICPJSPATH
        fi
    done < "sicp_publish/names.txt"
}

main