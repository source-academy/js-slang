#! /usr/bin/env bash

JSDOC="node_modules/.bin/jsdoc"
TMPL="doc/jsdoc/templates/template"
SRC="../cadet-frontend/public"
DST="doc/source/"
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

    # ALL
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README.md \
	     -d ${DST}/ \
	     doc/misc.js \
	     doc/list.js \
	     doc/stream.js \
	     ${SRC}/externalLibs/graphics/webGLrune.js \
	     ${SRC}/externalLibs/graphics/webGLcurve.js \
             ${SRC}/externalLibs/graphics ${SRC}/externalLibs/sound \
	     ${SRC}/externalLibs/tree.js

    # Source 1
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_1.md \
	     -d ${DST}/"Source §1"/ \
	     doc/misc.js 
    
    # Source 2
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_2.md \
	     -d ${DST}/"Source §2"/ \
	     doc/misc.js \
	     doc/list.js
    
    # Source 3
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_3.md \
	     -d ${DST}/"Source §3"/ \
	     doc/misc.js \
	     doc/list.js \
	     doc/stream.js
    
    # Source 4
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_4.md \
	     -d ${DST}/"Source §4"/ \
	     doc/misc.js \
	     doc/list.js \
	     doc/stream.js
    
    # MISC
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/MISC/ \
	     doc/misc.js
    
    # LISTS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/LISTS/ \
	     doc/list.js
    
    # STREAMS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/STREAMS/ \
	     doc/stream.js
    
    # RUNES
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/RUNES/ \
	     -R ${SRC}/externalLibs/graphics/RUNES_README.md \
	     ${SRC}/externalLibs/graphics/webGLrune.js

    # CURVES
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/CURVES/ \
	     -R ${SRC}/externalLibs/graphics/CURVES_README.md \
	     ${SRC}/externalLibs/graphics/webGLcurve.js

    # SOUNDS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/SOUNDS/ \
	     -R ${SRC}/externalLibs/sound/README.md \
	     ${SRC}/externalLibs/sound

    # BINARYTREES
    
    ${JSDOC} -r -t ${TMPL}/ \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/BINARYTREES \
	     ${SRC}/externalLibs/tree.js

    # External
    
    ${JSDOC} -r -t ${TMPL}/ \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_EXTERNAL.md \
	     -d ${DST}/"External libraries"/ \
	     ${SRC}/externalLibs/graphics/webGLrune.js \
	     ${SRC}/externalLibs/graphics/webGLcurve.js \
	     ${SRC}/externalLibs/sound
    
}

install() {

    cp -r doc/images ${DST} ; \
    cd doc; cp ${PDFSPECS} source; cd ..; \
    cd doc; scp -r source \
		sicp@web1.comp.nus.edu.sg:public_html/.

}

clean() {

    rm -rf  ${DST}
    
}

main $1
