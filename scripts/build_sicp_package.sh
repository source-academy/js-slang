#! /bin/bash

GLOBALFILE=src/globals.d.ts
SICPFILE=src/sicp.ts

main() {
    clean
    declare -a NAMES
    getnames
    writesicp
    delete
    writeglobal
    cleanUp
}
delete() {
    delete=(prompt undefined NaN Infinity)
    for target in "${delete[@]}"; do
        for i in "${!NAMES[@]}"; do
            if [[ ${NAMES[i]} = $target ]]; then
            unset 'NAMES[i]'
        fi
    done
    done
}

writesicp() {
    echo "import { dict, default as createContext } from \"./createContext\";" >> $SICPFILE

    echo "createContext(4);" >> $SICPFILE
}

writeglobal() {
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

clean() {
    rm -f $SICPFILE
    rm -f $GLOBALFILE
    rm -r sicp_publish/dist
    rm -f sicp_publish/names.txt
}

getnames() {
    yarn build
    node dist/sicp-prepare.js
    LINE=0
    while read -r CURRENT_LINE
    do 
        NAMES[$LINE]=$CURRENT_LINE
        ((LINE++))
    done < "sicp_publish/names.txt"
}

cleanUp() {
    yarn tsc
    cp -r dist sicp_publish
    rm -f src/globals.d.ts
    rm -f src/sicp.ts
    rm -f sicp_publish/names.txt
}

main

