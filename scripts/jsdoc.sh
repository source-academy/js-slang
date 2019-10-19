#! /usr/bin/env bash

JSDOC="node_modules/.bin/jsdoc"
TMPL="doc/jsdoc/templates/template"
SRC="../cadet-frontend/public"
DST="doc/source/"
PDFSPECS="source_1.pdf source_2.pdf source_3.pdf source_4.pdf source_styleguide.pdf"

main() {

    if [ "$1" == "install" ]; then
	install
    elif [ "$1" == "tocs1101s" ]; then
	tocs1101s
    elif [[ $(git rev-parse --show-toplevel 2> /dev/null) = "$PWD" ]]; then
        run
    else
        echo "Please run this command from the git root directory."
        false  # exit 1
    fi
}

run() {

    # Source landing page
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README.md \
	     -d ${DST}/ \
	     doc/empty.js

    # Source §1
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_1.md \
	     -d ${DST}/"source_1"/ \
	     doc/misc.js \
	     doc/math.js
    
    # Source §2
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_2.md \
	     -d ${DST}/"source_2"/ \
	     doc/misc.js \
	     doc/math.js \
	     doc/list.js
    
    # Source §3
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_3.md \
	     -d ${DST}/"source_3"/ \
	     doc/misc.js \
	     doc/math.js \
             doc/list.js \
	     doc/stream.js \
	     doc/array.js \
	     doc/pairmutator.js
    
    # Source §4
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_4.md \
	     -d ${DST}/"source_4"/ \
	     doc/misc.js \
	     doc/math.js \
	     doc/list.js \
	     doc/stream.js \
	     doc/array.js \
	     doc/pairmutator.js \
	     doc/mce.js
    
    # MISC
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_MISC.md \
	     -d ${DST}/MISC/ \
	     doc/misc.js
    
    # MATH
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_MATH.md \
	     -d ${DST}/MATH/ \
	     doc/math.js
    
    # LISTS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_LISTS.md \
	     -d ${DST}/LISTS/ \
	     doc/list.js
    
    # STREAMS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_STREAMS.md \
	     -d ${DST}/STREAMS/ \
	     doc/stream.js
    
    # ARRAYS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_ARRAYS.md \
	     -d ${DST}/ARRAYS/ \
	     doc/array.js
    
    # PAIRMUTATORS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_PAIRMUTATORS.md \
	     -d ${DST}/PAIRMUTATORS/ \
	     doc/pairmutator.js
    
    # MCE
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_MCE.md \
	     -d ${DST}/MCE/ \
	     doc/mce.js
    
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
	     ${SRC}/externalLibs/graphics/webGLcurve.js \
	     ${SRC}/externalLibs/graphics/webGLhi_graph.js

     # SOUNDS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d ${DST}/SOUNDS/ \
	     -R ${SRC}/externalLibs/sound/README.md \
	     ${SRC}/externalLibs/sound

    # BINARYTREES
    
    ${JSDOC} -r -t ${TMPL}/ \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_BINARYTREES.md \
	     -d ${DST}/BINARYTREES \
	     ${SRC}/externalLibs/tree.js

   # PIX&FLIX
    
    ${JSDOC} -r -t ${TMPL} \
	     -c doc/jsdoc/conf.json \
	     -d "${DST}/PIX&FLIX/" \
	     -R ${SRC}/externalLibs/video/README.md \
	     ${SRC}/externalLibs/video/video_lib.js 
    
    # External
    
    ${JSDOC} -r -t ${TMPL}/ \
	     -c doc/jsdoc/conf.json \
	     -R doc/README_EXTERNAL.md \
	     -d ${DST}/"External libraries"/ \
	     ${SRC}/externalLibs/graphics/webGLrune.js \
	     ${SRC}/externalLibs/graphics/webGLcurve.js \
	     ${SRC}/externalLibs/graphics/webGLhi_graph.js \
	     ${SRC}/externalLibs/video/video_lib.js \
	     ${SRC}/externalLibs/sound
    
}

install() {

    cp -r doc/images ${DST} ; \
    cd doc; cp ${PDFSPECS} source; cd ..; \
    cd doc; scp -r source \
		sicp@web1.comp.nus.edu.sg:public_html/.

}

tocs1101s() {

    cp -r doc/images ${DST} ; \
    cd doc; cp ${PDFSPECS} source; cd ..; \
    cd doc; scp -r source \
		cs1101s@sunfire.comp.nus.edu.sg:. ; \
    echo "now: ssh cs1101s@sunfire.comp.nus.edu.sg and: "; \
    echo "scp -r source sicp@web1.comp.nus.edu.sg:public_html"

}

clean() {

    rm -rf  ${DST}
    
}

main $1
