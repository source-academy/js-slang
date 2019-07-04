#! /usr/bin/env bash

JSDOC="node_modules/.bin/jsdoc"
TMPL="doc/jsdoc/templates/template"
SRC="../cadet-frontend/public"
DST="doc/jsdoc/libraries"
PDFSPECS="source_1.pdf source_2.pdf source_3.pdf source_4.pdf source_styleguide.pdf"

main() {

    if [ "$1" == "install" ]; then
	install
    elif [[ $(git rev-parse --show-toplevel 2> /dev/null) = "$PWD" ]]; then
        run
    else
        echo "Please run this command from the git root directory."
        false  # exit 1
    fi
}

run() {

    # SOUNDS
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/SOUND \
	     -R ${SRC}/externalLibs/sound/README.md \
	     ${SRC}/externalLibs/sound

    # RUNES
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/RUNES \
	     -R ${SRC}/externalLibs/graphics/README.md \
	     ${SRC}/externalLibs/graphics/webGLrune.js

}

install() {

    cd doc; scp -r ${PDFSPECS} sicp@web1.comp.nus.edu.sg:public_html/source/.; cd ..   
    cd doc/jsdoc; scp -r libraries sicp@web1.comp.nus.edu.sg:public_html/source/.
    
}

main $1
