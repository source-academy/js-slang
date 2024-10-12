#! /usr/bin/env bash

set -e

JSDOC="node_modules/.bin/jsdoc"
TMPL="docs/jsdoc/templates/template"
DST="docs/source"
MD="docs/md"
LIB="docs/lib"
SPECS="docs/specs"

main() {

    if [ "$1" == "prepare" ]; then
	prepare
    elif [ "$1" == "clean" ]; then
	clean
    elif [[ "$(git rev-parse --show-toplevel 2> /dev/null)" -ef "$PWD" ]]; then
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

	# Source §1 Typed
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_1_TYPED.md \
	     -d ${DST}/"source_1_typed"/ \
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
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js
    
    # Source §2 Lazy
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_2_LAZY.md \
	     -d ${DST}/"source_2_lazy"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js

    # Source §2 Typed
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_2_TYPED.md \
	     -d ${DST}/"source_2_typed"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js
   
    # Source §3
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_3.md \
	     -d ${DST}/"source_3"/ \
	     ${LIB}/auxiliary.js \
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
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
             ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js \
	     ${LIB}/concurrency.js

	# Source §3 Typed
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_3_TYPED.md \
	     -d ${DST}/"source_3_typed"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
         ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js
    
    # Source §4
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_4.md \
	     -d ${DST}/"source_4"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js \
	     ${LIB}/mce.js
    
    # Source §4 Explicit-Control
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_4_EXPLICIT-CONTROL.md \
	     -d ${DST}/"source_4_explicit-control"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js \
	     ${LIB}/mce.js \
	     ${LIB}/continuation.js

    # Source §4 GPU
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_4_GPU.md \
	     -d ${DST}/"source_4_gpu"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
		 ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js 

	# Source §4 Typed
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_4_TYPED.md \
	     -d ${DST}/"source_4_typed"/ \
	     ${LIB}/auxiliary.js \
	     ${LIB}/misc.js \
	     ${LIB}/math.js \
	     ${LIB}/list.js \
	     ${LIB}/stream.js \
	     ${LIB}/array.js \
	     ${LIB}/pairmutator.js \
	     ${LIB}/mce.js

    # AUXILIARY

    ${JSDOC} -r -t ${TMPL} \
       -c docs/jsdoc/conf.json \
       -R ${MD}/README_AUXILIARY.md \
       -d ${DST}/AUXILIARY/ \
       ${LIB}/auxiliary.js

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

    # CONTINUATION
    
    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_CONTINUATION.md \
	     -d ${DST}/CONTINUATION/ \
	     ${LIB}/continuation.js
    
    # EV3

    ${JSDOC} -r -t ${TMPL} \
	     -c docs/jsdoc/conf.json \
	     -d "${DST}/EV3/" \
	     -R ${MD}/EV3_README.md \
	     ${LIB}/ev3.js

    # External

    ${JSDOC} -r -t ${TMPL}/ \
	     -c docs/jsdoc/conf.json \
	     -R ${MD}/README_EXTERNAL.md \
	     -d ${DST}/"External libraries"/ \
	     ${LIB}/ev3.js
}

prepare() {
    run
    cp -r docs/images ${DST} ; \
    cd ${SPECS}; make; cp *.pdf ../source; cd ../..
}

clean() {

    rm -rf  ${DST}/*
    
}

main $1
