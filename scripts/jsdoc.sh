#! /usr/bin/env bash

JSDOC="node_modules/.bin/jsdoc"
TMPL="docs/jsdoc/templates/template"
DST="docs/source"
MD="docs/md"
LIB="docs/lib"
SPECS="docs/specs"

main() {

    if [ "$1" == "install" ]; then
	install
    elif [ "$1" == "prepare" ]; then
	prepare
    elif [ "$1" == "clean" ]; then
	clean
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
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_top.md \
	     -d ${DST}/ \
	     ${LIB}/empty.js

    # Source §1
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_1.md \
	     -d ${DST}/"source_1"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js
    
    # Source §1 Lazy
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_1_LAZY.md \
	     -d ${DST}/"source_1_lazy"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js
    
    # Source §1 WebAssembly
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_1_WASM.md \
	     -d ${DST}/"source_1_wasm"/ \
	     ${LIB}/empty.js
    
    # Source §2
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_2.md \
	     -d ${DST}/"source_2"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js
    
    # Source §2 Lazy
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_2_LAZY.md \
	     -d ${DST}/"source_2_lazy"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js
    
    # Source §3
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_3.md \
	     -d ${DST}/"source_3"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
             ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js
    
    # Source §3 Concurrent
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_3_CONCURRENT.md \
	     -d ${DST}/"source_3_concurrent"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
             ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js \
	     ${LIB}/concurrency.js
    
    
    # Source §4
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_4.md \
	     -d ${DST}/"source_4"/ \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js \
	     ${LIB}/mce.js
    
    # MISC
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_MISC.md \
	     -d ${DST}/MISC/ \
	     ${LIB}/misc.js
    
    # MATH
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_MATH.md \
	     -d ${DST}/MATH/ \
	     ${LIB}/math.js
    
    # LISTS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_LISTS.md \
	     -d ${DST}/LISTS/ \
	     ${LIB}/list.js
    
    # STREAMS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_STREAMS.md \
	     -d ${DST}/STREAMS/ \
	     ${LIB}/stream.js
    
    # ARRAYS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_ARRAYS.md \
	     -d ${DST}/ARRAYS/ \
	     ${LIB}/array.js
    
    # PAIRMUTATORS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_PAIRMUTATORS.md \
	     -d ${DST}/PAIRMUTATORS/ \
	     ${LIB}/pairmutator.js
    
    # CONCURRENCY
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_CONCURRENCY.md \
	     -d ${DST}/CONCURRENCY/ \
	     ${LIB}/concurrency.js
    
    # MCE
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_MCE.md \
	     -d ${DST}/MCE/ \
	     ${LIB}/mce.js
    
    # RUNES
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -d ${DST}/RUNES/ \
	     -R ${MD}/RUNES_README.md \
	     ${LIB}/webGLrune.js

    # CURVES
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -d ${DST}/CURVES/ \
	     -R ${MD}/CURVES_README.md \
	     ${LIB}/webGLcurve.js \
	     ${LIB}/webGLhi_graph.js

     # SOUNDS
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -d ${DST}/SOUNDS/ \
	     -R ${MD}/SOUNDS_README.md \
	     ${LIB}/sound

    # BINARYTREES
    
    ${JSDOC} -r -t ${TMPL}/ \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_BINARYTREES.md \
	     -d ${DST}/BINARYTREES \
	     ${LIB}/tree.js

   # PIX&FLIX
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -d "${DST}/PIX&FLIX/" \
	     -R ${MD}/VIDEO_README.md \
	     ${LIB}/video_lib.js 
    
    # External
    
    ${JSDOC} -r -t ${TMPL}/ \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_EXTERNAL.md \
	     -d ${DST}/"External libraries"/ \
	     ${LIB}/webGLrune.js \
	     ${LIB}/webGLcurve.js \
	     ${LIB}/webGLhi_graph.js \
	     ${LIB}/video_lib.js \
	     ${LIB}/sound
    
}

prepare() {
    run
    cp -r docs/images ${DST} ; \
    cd ${SPECS}; make; cp *.pdf ../source; cd ../..
}

install() {
    prepare
    cd docs; scp -r ${DST} sicp@web1.comp.nus.edu.sg:public_html/.
}

tocs1101s() {
    prepare 
    cd docs; scp -r source cs1101s@sunfire.comp.nus.edu.sg:. ; \
    echo "now: ssh cs1101s@sunfire.comp.nus.edu.sg and: "; \
    echo "scp -r source sicp@web1.comp.nus.edu.sg:public_html"

}

clean() {

    rm -rf  ${DST}/*
    
}

main $1
