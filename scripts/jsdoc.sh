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

    # LISTS
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/LISTS \
	     doc/list.js
    
    # STREAMS
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/STREAMS \
	     doc/stream.js
    
    # RUNES
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/RUNES \
	     -R ${SRC}/externalLibs/graphics/RUNES_README.md \
	     ${SRC}/externalLibs/graphics/webGLrune.js

    # CURVES
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/CURVES \
	     -R ${SRC}/externalLibs/graphics/CURVES_README.md \
	     ${SRC}/externalLibs/graphics/webGLcurve.js

    # SOUNDS
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/SOUNDS \
	     -R ${SRC}/externalLibs/sound/README.md \
	     ${SRC}/externalLibs/sound

    # BINARYTREES
    
    ${JSDOC} -r -t ${TMPL} \
	     -d ${DST}/BINARYTREES \
	     ${SRC}/externalLibs/tree.js

}

install() {

    cd doc; scp -r ${PDFSPECS} \
		sicp@web1.comp.nus.edu.sg:public_html/source/.; \
    cd ..   

    cd doc/jsdoc; \
	scp -r libraries sicp@web1.comp.nus.edu.sg:public_html/source/.
    
}

main $1
