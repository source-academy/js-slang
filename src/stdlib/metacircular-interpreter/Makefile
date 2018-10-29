INTERPRETER_CORE = lib/exports.js.tpl \
	lib/interpreter/interpreter.js \
	lib/interpreter/json2.js \
	lib/interpreter/parser.jison.tpl \
	lib/util/io.js

PARSER = lib/interpreter/parser.js

.PHONY: environment academy

all: environment

# removed from dependencies for environment: ../list.js ../object.js ../stream.js
environment: lib/interpreter/parser.js 

clean:
	rm -f jediscript-*.js

distclean: clean
	rm -f lib/*.js

academy: environment
	node generate.js --interpreter 5 --without_jquery
	node generate.js --interpreter 8 --without_jquery
	node generate.js --interpreter 13 --without_jquery --debug

offline_zip: environment
	node generate.js --interpreter 5
	node generate.js --interpreter 8
	node generate.js --interpreter 13

$(PARSER): $(INTERPRETER_CORE)
	node generate.js --environment
