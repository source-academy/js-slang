/*
 * This file defines the symbols which are accessible from student code.
 *
 * This also will register the given functions with the interpreter.
 */

/**
 * Defines a symbol to be usable within the interpreter, and also globally in
 * the event of compiler mangling.
 *
 * @param string name The name of the symbol to be exported.
 * @param mixed symbol The symbol (function, variable, etc) to be exported.
 * @param string params The parameter list to show in the obfuscated function.
 *                      Used only when obfuscated is true.
 * @param boolean obfuscated Whether to obfuscate the definition of functions.
 *                           Defaults to true.
 */
function export_symbol(name, symbol, params, obfuscated) {
	if (symbol === undefined) {
		symbol = window[name];
	}
	window[name] = symbol;
	if (is_function(symbol)) {
		if (obfuscated === undefined || obfuscated) {
			parser_register_native_function(name, obfuscate(symbol, name, params));
		} else {
			parser_register_native_function(name, symbol);
		}
	} else {
		parser_register_native_variable(name, symbol);
	}
}

//Reserve '$' for jQuery when jQuery library itself is not included
window['$'] = $;
//Preserve export_symbol for use by missions (so they can export APIs and
//variables to student code)
window['exportSymbol'] = export_symbol; // Remove in AY2015/2016.
window['export_symbol'] = export_symbol;
window['parse_and_evaluate'] = parse_and_evaluate;
window['parser_register_debug_handler'] = parser_register_debug_handler;

//Core language
export_symbol("Math", Math);

export_symbol("String", String);


//Misc.js
export_symbol('is_null', is_null, "(x)");
export_symbol('is_number', is_number, "(x)");
export_symbol('is_string', is_string, "(x)");
export_symbol('is_boolean', is_boolean, "(x)");
export_symbol('is_object', is_object, "(x)");
export_symbol('is_function', is_function, "(x)");
export_symbol('is_NaN', is_NaN, "(x)");
export_symbol('has_own_property', has_own_property);
export_symbol('is_array', is_array, "(x)");
export_symbol('runtime', runtime);
export_symbol('error', error, "(message)");
export_symbol('newline', newline);
export_symbol('display', display, "(message)");
export_symbol('random', random);
export_symbol('timed', timed, "(f)");
export_symbol('read', read);
export_symbol('write', write);

export_symbol('parse', parse, "(source_text)");
export_symbol('apply_in_underlying_javascript', apply_in_underlying_javascript);



//List.js
export_symbol('array_test', array_test);
export_symbol('pair', pair, "(x, y)");
export_symbol('is_pair', is_pair, "(x)");
export_symbol('head', head, "(xs)");
export_symbol('tail', tail, "(xs)");
export_symbol('is_empty_list', is_empty_list, "(xs)");
export_symbol('is_list', is_list, "(x)");
export_symbol('list', list);
export_symbol('list_to_vector', list_to_vector, "(xs)");
export_symbol('vector_to_list', vector_to_list, "(v)");
export_symbol('length', length, "(xs)");
export_symbol('map', map, "(f, xs)");
export_symbol('build_list', build_list, "(n, f)");
export_symbol('for_each', for_each, "(f, xs)");
export_symbol('list_to_string', list_to_string, "(xs)");
export_symbol('reverse', reverse, "(xs)");
export_symbol('append', append, "(xs, ys)");
export_symbol('member', member, "(v, xs)");
export_symbol('remove', remove, "(v, xs)");
export_symbol('remove_all', remove_all, "(v, xs)");
export_symbol('equal', equal, "(x, y)");

export_symbol('assoc', assoc, "(v, xs)");

export_symbol('filter', filter, "(pred, xs)");
export_symbol('enum_list', enum_list, "(start, end)");
export_symbol('list_ref', list_ref, "(xs, n)");
export_symbol('accumulate', accumulate, "(op, initial, xs)");

export_symbol('set_head', set_head, "(xs, x)");
export_symbol('set_tail', set_tail, "(xs, x)");




//Object.js
parser_register_native_function('Object', Object);
export_symbol('is_instance_of', is_instance_of, "(a, b)");



//Streams.js
export_symbol('stream_tail', stream_tail, "(xs)");
export_symbol('is_stream', is_stream, "(xs)");
export_symbol('list_to_stream', list_to_stream, "(xs)");
export_symbol('stream_to_list', stream_to_list, "(xs)");
export_symbol('stream', stream);
export_symbol('stream_length', stream_length, "(xs)");
export_symbol('stream_map', stream_map, "(f, xs)");
export_symbol('build_stream', build_stream, "(n, f)");
export_symbol('stream_for_each', stream_for_each, "(f, xs)");
export_symbol('stream_reverse', stream_reverse, "(xs)");
export_symbol('stream_to_vector', stream_to_vector, "(xs)");
export_symbol('stream_append', stream_append, "(xs, ys)");
export_symbol('stream_member', stream_member, "(v, xs)");
export_symbol('stream_remove', stream_remove, "(v, xs)");
export_symbol('stream_remove_all', stream_remove_all, "(v, xs)");
export_symbol('stream_filter', stream_filter, "(pred, xs)");
export_symbol('enum_stream', enum_stream, "(start, end)");
export_symbol('integers_from', integers_from, "(n)");
export_symbol('eval_stream', eval_stream, "(xs, n)");
export_symbol('stream_ref', stream_ref, "(xs, n)");



//Interpreter.js
export_symbol('parse_and_evaluate', parse_and_evaluate);
export_symbol('parser_register_native_function', parser_register_native_function);
export_symbol('parser_register_native_variable', parser_register_native_variable);
export_symbol('is_object', is_object);
export_symbol('JSON', JSON);
export_symbol('Function', Function);
export_symbol('RegExp', RegExp);

