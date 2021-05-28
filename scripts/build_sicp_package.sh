#! /bin/bash

GLOBALFILE=src/globals.d.ts
SICPFILE=src/sicp.ts

main() {
    clean
    declare -a NAMES
    getNames
    writeSicp
    deleteSomeNames
    writeGlobal
    finish
    clean
}

clean() {
    rm -f $SICPFILE
    rm -f $GLOBALFILE
    rm -f sicp_publish/names.txt
}

# Get names of all functions
getNames() {
    yarn build
    node dist/sicp-prepare.js
    LINE=0
    while read -r CURRENT_LINE
    do 
        NAMES[$LINE]=$CURRENT_LINE
        ((LINE++))
    done < "sicp_publish/names.txt"
}

writeSicp() {
    echo "import { dict, default as createContext } from \"./createContext\";" >> $SICPFILE

    echo "createContext(4);" >> $SICPFILE
}

# Since several variables are declared globally initially
deleteSomeNames() {
    delete=(prompt undefined NaN Infinity)
    for target in "${delete[@]}"; do
        for i in "${!NAMES[@]}"; do
            if [[ ${NAMES[i]} = $target ]]; then
            unset 'NAMES[i]'
        fi
    done
    done
}

writeGlobal() {
    for NAME in "${NAMES[@]}"
    do
        echo "global.$NAME = dict[\"$NAME\"];" >> $SICPFILE
    done

    echo "declare module NodeJS {" >> $GLOBALFILE
    echo "interface Global {" >> $GLOBALFILE

    for NAME in "${NAMES[@]}"
    do
        echo "$NAME: any," >> $GLOBALFILE
    done

    echo "}" >> $GLOBALFILE
    echo "}" >> $GLOBALFILE

    for NAME in "${NAMES[@]}"
    do 
        echo "declare let $NAME: any;" >> $GLOBALFILE
    done
    
}

finish() {
    yarn tsc
    rm -rf sicp_publish/dist
    cp -r dist sicp_publish
    cd sicp_publish/dist
    find . -type f ! -name '*.js' -delete
    rm -r __tests__ editors lazy mocks name-extractor repl stepper validator vm
    rm finder.js index.js scope-refactoring.js sicp-prepare.js
    cd ../..
}

main