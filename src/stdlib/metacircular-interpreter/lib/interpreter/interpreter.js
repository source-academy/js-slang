/**
 * Parses the given string and returns the evaluated result.
 *
 * @param String string The string to evaluate.
 * @returns The result of evaluating the given expression/program text.
 */
var parse_and_evaluate = undefined;
/**
 * Registers a native JavaScript function for use within the interpreter.
 *
 * @param String name The name of the function to expose.
 * @param Function func The Function to export.
 */
var parser_register_native_function = undefined;
/**
 * Registers a native JavaScript variable for use within the interpreter.
 * 
 * @param String name The name of the variable to expose.
 * @param Object object The Object to export.
 */
var parser_register_native_variable = undefined;
/**
 * Registers a native JavaScript handler for when a debug context is changed.
 *
 * @param Function handler The callback handling all such requests. This
 *                         callback accepts one argument, the line of the
 *                         call. If this is null, then there is no debug
 *                         context active.
 */
var parser_register_debug_handler = undefined;

(function() {
function stmt_line(stmt) {
	return stmt.line;
}
function is_tagged_object(stmt,the_tag) {
	return is_object(stmt) &&
		stmt.tag === the_tag;
}

function is_self_evaluating(stmt) {
	return is_number(stmt) ||
		is_string(stmt) ||
		is_boolean(stmt);
}

function is_empty_list_statement(stmt) {
	return is_tagged_object(stmt,"empty_list");
}

function evaluate_empty_list_statement(input_text,stmt,env) {
	return [];
}

function make_undefined_value() {
	return undefined;
}

function is_undefined_value(value) {
	return value === undefined;
}

function is_variable(stmt) {
	return is_tagged_object(stmt,"variable");
}

function variable_name(stmt) {
	return stmt.name;
}

function enclosing_environment(env) {
	return tail(env);
}
function first_frame(env) {
	return head(env);
}
var the_empty_environment = [];
function is_empty_environment(env) {
	return is_empty_list(env);
}
function enclose_by(frame,env) {
	return pair(frame,env);
}

function lookup_variable_value(variable,env) {
	function env_loop(env) {
		if (is_empty_environment(env)) {
			error("Unbound variable: " + variable);
		} else if (has_binding_in_frame(variable,first_frame(env))) {
			return first_frame(env)[variable];
		} else {
			return env_loop(enclosing_environment(env));
		}
	}
	var val = env_loop(env);
	return val;
}

function is_assignment(stmt) {
	return is_tagged_object(stmt,"assignment");
}
function assignment_variable(stmt) {
	return stmt.variable;
}
function assignment_value(stmt) {
	return stmt.value;
}

function set_variable_value(variable,value,env) {
	function env_loop(env) {
		if (is_empty_environment(env)) {
			error("Undeclared variable in assignment: " + variable_name(variable));
		} else if (has_binding_in_frame(variable_name(variable),first_frame(env))) {
			add_binding_to_frame(variable_name(variable),value,first_frame(env));
		} else {
			env_loop(enclosing_environment(env));
		}
	}
	env_loop(env);
	return undefined;
}

function evaluate_assignment(input_text,stmt,env) {
	var value = evaluate(input_text,assignment_value(stmt),env);
	set_variable_value(assignment_variable(stmt),
		value,
		env);
	return value;
}

function is_array_expression(stmt) {
	return is_tagged_object(stmt,"arrayinit");
}

function array_expression_elements(stmt) {
	return stmt.elements;
}

function evaluate_array_expression(input_text,stmt, env) {
	var evaluated_elements = map(function(p) {
			return evaluate(input_text,p,env);
		},
		array_expression_elements(stmt));

	return list_to_vector(evaluated_elements);
}

function is_object_expression(stmt) {
	return is_tagged_object(stmt,"object");
}

function object_expression_pairs(stmt) {
	return stmt.pairs;
}

function evaluate_object_expression(input_text,stmt,env) {
	var evaluated_pairs = map(function(p) {
			return pair(evaluate(input_text,head(p),env),
				evaluate(input_text,tail(p),env));
		},
		object_expression_pairs(stmt));
	
	function make_object(pairs_to_handle, constructed_object) {
		if (is_empty_list(pairs_to_handle)) {
			return constructed_object;
		} else {
			constructed_object[head(head(pairs_to_handle))] =
				tail(head(pairs_to_handle));
			return make_object(tail(pairs_to_handle), constructed_object);
		}
	}
	return make_object(evaluated_pairs,{});
}



function is_property_assignment(stmt) {
	return is_tagged_object(stmt,"property_assignment");
}

function property_assignment_object(stmt) {
	return stmt.object;
}

function property_assignment_property(stmt) {
	return stmt.property;
}

function property_assignment_value(stmt) {
	return stmt.value;
}

function evaluate_property_assignment(input_text,stmt,env) {
	var obj = evaluate(input_text,property_assignment_object(stmt),env);
	var property = evaluate(input_text,property_assignment_property(stmt),env);
	var value = evaluate(input_text,property_assignment_value(stmt),env);
	obj[property] = value;
	return value;
}

function is_property_access(stmt) {
	var x = is_tagged_object(stmt,"property_access");
	return x;
}

function property_access_object(stmt) {
	return stmt.object;
}

function property_access_property(stmt) {
	return stmt.property;
}

/**
 * Evaluates a property access statement.
 */
function evaluate_property_access(input_text,statement,env) {
	var objec = evaluate(input_text,property_access_object(statement),env);
	var property = evaluate(input_text,property_access_property(statement),env);
	return evaluate_object_property_access(objec, property);
}

/**
 * Actually does the property access.
 */
function evaluate_object_property_access(object, property) {
	var result = object[property];

	//We need to post-process the return value. Because objects can be native
	//we need to marshal native member functions into our primitive tag.
	return wrap_native_value(result);
}

function is_var_definition(stmt) {
	return is_tagged_object(stmt,"var_definition");
}
function var_definition_variable(stmt) {
	return stmt.variable;
}
function var_definition_value(stmt) {
	return stmt.value;
}

function make_frame(variables,values) {
	if (is_empty_list(variables) && is_empty_list(values)) {
		return {};
	} else {
		var frame = make_frame(tail(variables),tail(values));
		frame[head(variables)] = head(values);
		return frame;
	}
}

function add_binding_to_frame(variable,value,frame) {
	frame[variable] = value;
	return undefined;
}
function has_binding_in_frame(variable,frame) {
	return has_own_property(frame, variable);
}

function define_variable(variable,value,env) {
	var frame = first_frame(env);
	return add_binding_to_frame(variable,value,frame);
}

function evaluate_var_definition(input_text,stmt,env) {
	define_variable(var_definition_variable(stmt),
		evaluate(input_text,var_definition_value(stmt),env),
		env);
	return undefined;
}

function is_if_statement(stmt) {
	return is_tagged_object(stmt,"if");
}
function if_predicate(stmt) {
	return stmt.predicate;
}
function if_consequent(stmt) {
	return stmt.consequent;
}
function if_alternative(stmt) {
	return stmt.alternative;
}

function is_true(x) {
	return ! is_false(x);
}
function is_false(x) {
	return x === false || x === 0 || x === "" || is_undefined_value(x) || is_NaN(x);
}

function is_boolean_operation(stmt) {
	return is_tagged_object(stmt, "boolean_op");
}

function evaluate_boolean_operation(input_text,stmt, args, env) {
	var lhs = evaluate(input_text,list_ref(args, 0), env);
	if (operator(stmt) === '||') {
		if (lhs) {
			return lhs;
		} else {
			return evaluate(input_text,list_ref(args, 1), env);
		}
	} else if (operator(stmt) === '&&') {
		if (!lhs) {
			return lhs;
		} else {
			return evaluate(input_text,list_ref(args, 1), env);
		}
	} else {
		error("Unknown binary operator: " + operator(stmt), stmt_line(stmt));
	}
}

function evaluate_if_statement(input_text,stmt,env) {
	if (is_true(evaluate(input_text,if_predicate(stmt),env))) {
		return evaluate(input_text,if_consequent(stmt),env);
	} else {
		return evaluate(input_text,if_alternative(stmt),env);
	}
}

function is_ternary_statement(stmt) {
	return is_tagged_object(stmt, "ternary");
}
function ternary_predicate(stmt) {
	return stmt.predicate;
}
function ternary_consequent(stmt) {
	return stmt.consequent;
}
function ternary_alternative(stmt) {
	return stmt.alternative;
}
function evaluate_ternary_statement(input_text,stmt, env) {
	if (is_true(evaluate(input_text,ternary_predicate(stmt), env))) {
		return evaluate(input_text,ternary_consequent(stmt), env);
	} else {
		return evaluate(input_text,ternary_alternative(stmt), env);
	}
}

function is_while_statement(stmt) {
	return is_tagged_object(stmt, "while");
}
function while_predicate(stmt) {
	return stmt.predicate;
}
function while_statements(stmt) {
	return stmt.statements;
}
function evaluate_while_statement(input_text,stmt, env) {
	var result = undefined;
	while (is_true(evaluate(input_text,while_predicate(stmt), env))) {
		var new_result = evaluate(input_text,while_statements(stmt), env);
		if (is_return_value(new_result) ||
			is_tail_recursive_return_value(new_result)) {
			return new_result;
		} else if (is_break_value(new_result)) {
			break;
		} else if (is_continue_value(new_result)) {
			continue;
		} else {
			result = new_result;
		}
	}
	return result;
}

function is_for_statement(stmt) {
	return is_tagged_object(stmt, "for");
}
function for_initialiser(stmt) {
	return stmt.initialiser;
}
function for_predicate(stmt) {
	return stmt.predicate;
}
function for_finaliser(stmt) {
	return stmt.finaliser;
}
function for_statements(stmt) {
	return stmt.statements;
}
function evaluate_for_statement(input_text,stmt, env) {
	var result = undefined;
	for (evaluate(input_text,for_initialiser(stmt), env);
		is_true(evaluate(input_text,for_predicate(stmt), env));
		evaluate(input_text,for_finaliser(stmt), env)) {
		var new_result = evaluate(input_text,for_statements(stmt), env);

		if (is_return_value(new_result) ||
			is_tail_recursive_return_value(new_result)) {
			return new_result;
		} else if (is_break_value(new_result)) {
			break;
		} else if (is_continue_value(new_result)) {
			continue;
		} else {
			result = new_result;
		}
	}
	return result;
}

function is_function_definition(stmt) {
	return is_tagged_object(stmt,"function_definition");
}

function function_definition_name(stmt) {
	return stmt.name;
}
function function_definition_parameters(stmt) {
	return stmt.parameters;
}
function function_definition_body(stmt) {
	return stmt.body;
}
function function_definition_text_location(stmt) {
	return stmt.location;
}

function evaluate_function_definition(input_text,stmt,env) {
	return make_function_value(
		input_text,
		function_definition_name(stmt),
		function_definition_parameters(stmt),
		function_definition_body(stmt),
		function_definition_text_location(stmt),
		env);
}
function make_function_value(input_text,name,parameters,body,location,env) {
	var result = (new Function("apply", "wrap_native_value",
	"return function " + name + "() {\n\
		var args = map(wrap_native_value, vector_to_list(arguments));\n\
		return apply(arguments.callee, args, this);\n\
	}"))(apply, wrap_native_value);
	result.tag = "function_value";
	result.parameters = parameters;
	result.body = body;
	result.source_text = input_text;
	result.environment = env;

	var text = get_input_text(input_text,location.start_line, location.start_col,
		location.end_line, location.end_col);
	result.toString = function() {
		return text;
	};
	result.toSource = result.toString;
	return result;
}
function is_compound_function_value(f) {
	return is_tagged_object(f,"function_value");
}
function function_value_parameters(value) {
	return value.parameters;
}
function function_value_body(value) {
	return value.body;
}
function function_value_environment(value) {
	return value.environment;
}
function function_value_name(value) {
	return value.name;
}
function function_value_source_text(value) {
	return value.source_text;
}

function is_construction(stmt) {
	return is_tagged_object(stmt, "construction");
}
function construction_type(stmt) {
	return stmt.type;
}
function evaluate_construction_statement(input_text,stmt, env) {
	var typename = evaluate(input_text,construction_type(stmt), env);
	var type = lookup_variable_value(typename, env);
	var result = undefined;
	var extraResult = undefined;
	if (is_primitive_function(type)) {
		result = Object.create(primitive_implementation(type).prototype);
	} else {
		//TODO: This causes some problems because we add more fields to the prototype of the object.
		result = Object.create(type.prototype);
	}
	
	extraResult = apply(type, list_of_values(input_text,operands(stmt),env), result);

	//EcmaScript 5.1 Section 13.2.2 [[Construct]]
	if (is_object(extraResult)) {
		return extraResult
	} else {
		return result;
	}
}

function is_sequence(stmt) {
	return is_list(stmt);
}
function empty_stmt(stmts) {
	return is_empty_list(stmts);
}
function last_stmt(stmts) {
	return is_empty_list(tail(stmts));
}
function first_stmt(stmts) {
	return head(stmts);
}
function rest_stmts(stmts) {
	return tail(stmts);
}

function evaluate_sequence(input_text,stmts,env) {
	while (!empty_stmt(stmts)) {
		var statement_result = evaluate(input_text,first_stmt(stmts), env);
		if (last_stmt(stmts)) {
			return statement_result;
		} else if (is_return_value(statement_result) ||
			is_tail_recursive_return_value(statement_result)) {
			return statement_result;
		} else if (is_break_value(statement_result) ||
			is_continue_value(statement_result)) {
			return statement_result;
		} else {
			stmts = rest_stmts(stmts);
		}
	}
}

function is_application(stmt) {
	return is_tagged_object(stmt,"application");
}
function is_object_method_application(stmt) {
	return is_tagged_object(stmt,"object_method_application");
}
function operator(stmt) {
	return stmt.operator;
}
function operands(stmt) {
	return stmt.operands;
}
function no_operands(ops) {
	return is_empty_list(ops);
}
function first_operand(ops) {
	return head(ops);
}
function rest_operands(ops) {
	return tail(ops);
}
function object(stmt) {
	return stmt.object;
}
function object_property(stmt) {
	return stmt.property;
}

function is_primitive_function(fun) {
	return is_tagged_object(fun,"primitive");
}
function primitive_implementation(fun) {
	return fun;
}

// This function is used to map whatever a native JavaScript function returns,
// and tags it such that the interpreter knows what to do with it.
// apply_in_underlying_javascript marshals interpreter to native; this handles
// the other direction.
function wrap_native_value(val) {
	if (is_function(val) && val.tag === undefined) {
		return make_primitive_function_object(val);
	} else {
		return val;
	}
}
function apply_primitive_function(fun,argument_list,object) {
	return wrap_native_value(
		apply_in_underlying_javascript.call(object,primitive_implementation(fun),
			argument_list)
	);
}

function extend_environment(vars,vals,base_env) {
	var var_length = length(vars);
	var val_length = length(vals);
	if (var_length === val_length) {
		var new_frame = make_frame(vars,vals);
		return enclose_by(new_frame,base_env);
	} else if (var_length < val_length) {
		error("Too many arguments supplied: " + JSON.stringify(vars) +
			JSON.stringify(vals));
	} else {
		error("Too few arguments supplied: " + JSON.stringify(vars) +
			JSON.stringify(vals));
	}
}

function is_break_statement(stmt) {
	return is_tagged_object(stmt, "break_statement");
}

function make_break_value() {
	return { tag: "break_value" };
}

function is_break_value(value) {
	return is_tagged_object(value, "break_value");
}

function is_continue_statement(stmt) {
	return is_tagged_object(stmt, "continue_statement");
}

function make_continue_value() {
	return { tag: "continue_value" };
}

function is_continue_value(value) {
	return is_tagged_object(value, "continue_value");
}

function is_return_statement(stmt) {
	return is_tagged_object(stmt,"return_statement");
}
function return_statement_expression(stmt) {
	return stmt.expression;
}

function make_return_value(content) {
	return { tag: "return_value", content: content };
}
function is_return_value(value) {
	return is_tagged_object(value,"return_value");
}
function return_value_content(value) {
	return value.content;
}
function make_tail_recursive_return_value(fun, args, obj, env) {
	return { tag: "tail_recursive_return_value", fun: fun, args: args, obj: obj, env: env };
}
function is_tail_recursive_return_value(value) {
	return is_tagged_object(value, "tail_recursive_return_value");
}
function tail_recursive_function(value) {
	return value.fun;
}
function tail_recursive_arguments(value) {
	return value.args;
}
function tail_recursive_object(value) {
	return value.obj;
}
function tail_recursive_environment(value) {
	return value.env;
}

function apply(fun,args,obj) {
	var result = undefined;
	while (result === undefined || is_tail_recursive_return_value(result)) {
		if (is_primitive_function(fun)) {
			return apply_primitive_function(fun,args,obj);
		} else if (is_compound_function_value(fun)) {
			if (length(function_value_parameters(fun)) === length(args)) {
				var env = extend_environment(function_value_parameters(fun),
						args,
						function_value_environment(fun));
				if (obj && is_object(obj)) {
					add_binding_to_frame("this", obj, first_frame(env));
				} else {}

				//We have to pass in the source text we had at the function evaluation
				//time because we might evaluate new functions within and those would
				//require original input (since we hold references to the original
				//source text)
				var result = evaluate(function_value_source_text(fun),function_value_body(fun), env);
				if (is_return_value(result)) {
					return return_value_content(result);
				} else if (is_tail_recursive_return_value(result)) {
					fun = tail_recursive_function(result);
					args = tail_recursive_arguments(result);
					obj = tail_recursive_object(result);
					env = tail_recursive_environment(result);
				} else if (is_break_value(result) || is_continue_value(result)) {
					error("break and continue not allowed outside of function.");
				} else {
					return undefined;
				}
			} else {
				error('Incorrect number of arguments supplied for function ' +
					function_value_name(fun));
			}
		} else if (fun === undefined) {
			error("Unknown function type for application: undefined");
		} else {
			error("Unknown function type for application: " + JSON.stringify(fun),
				stmt_line(fun));
		}
	}
}

function list_of_values(input_text,exps,env) {
	if (no_operands(exps)) {
		return [];
	} else {
		return pair(evaluate(input_text,first_operand(exps),env),
			list_of_values(input_text,rest_operands(exps),env));
	}
}

var primitive_functions = 
	list(
	//Builtin functions
	pair("alert", alert),
	pair("prompt", prompt),
	pair("parseInt", parseInt),

	//List library functions
	pair("pair", pair),
	pair("head", head),
	pair("tail", tail),
	pair("list", list),
	pair("length", length),
	pair("map", map),
	pair("is_empty_list", is_empty_list),

	//Intepreter functions
	pair("parse", parse),
	pair("error", error),

	//Primitive functions
	pair("+", function(x,y) { return x + y; }),
	pair("-", function(x,y) { return x - y; }),
	pair("*", function(x,y) { return x * y; }),
	pair("/", function(x,y) { return x / y; }),
	pair("%", function(x,y) { return x % y; }),
	pair("===", function(x,y) { return x === y; }),
	pair("!==", function(x,y) { return x !== y; }),
	pair("<", function(x,y) { return x < y; }),
	pair(">", function(x,y) { return x > y; }),
	pair("<=", function(x,y) { return x <= y; }),
	pair(">=", function(x,y) { return x >= y; }),
	pair("!", function(x) { return ! x; })
	);

function primitive_function_names() {
	return map(function(x) { return head(x); },
		primitive_functions);
}

function primitive_function_objects() {
	return map(
		function(f) {
			if (!is_compound_function_value(tail(f))) {
				return make_primitive_function_object(tail(f));
			} else {
				return tail(f);
			}
		},
		primitive_functions);
}

function make_primitive_function_object(primitive_function) {
	if (primitive_function.tag && primitive_function.tag !== "primitive") {
		error('Cannot tag an already tagged object: ' + JSON.stringify(primitive_function) + '/' + primitive_function + '/' + primitive_function.tag);
	} else {}
	primitive_function.tag = "primitive";
	return primitive_function;
}

var expires = undefined;
function evaluate(input_text,stmt,env) {
	if ((new Date()).getTime() > expires) {
		error('Time limit exceeded.');
	} else if (is_self_evaluating(stmt)) {
		return stmt;
	} else if (is_empty_list_statement(stmt)) {
		return evaluate_empty_list_statement(input_text,stmt,env);
	} else if (is_variable(stmt)) {
		return lookup_variable_value(variable_name(stmt),env);
	} else if (is_assignment(stmt)) {
		return evaluate_assignment(input_text,stmt,env);
	} else if (is_var_definition(stmt)) {
		return evaluate_var_definition(input_text,stmt,env);
	} else if (is_if_statement(stmt)) {
		return evaluate_if_statement(input_text,stmt,env);
	} else if (is_ternary_statement(stmt)) {
		return evaluate_ternary_statement(input_text,stmt,env);
	} else if (is_while_statement(stmt)) {
		return evaluate_while_statement(input_text,stmt,env);
	} else if (is_for_statement(stmt)) {
		return evaluate_for_statement(input_text,stmt,env);
	} else if (is_function_definition(stmt)) {
		return evaluate_function_definition(input_text,stmt,env);
	} else if (is_sequence(stmt)) {
		return evaluate_sequence(input_text,stmt,env);
	} else if (is_boolean_operation(stmt)) {
		return evaluate_boolean_operation(input_text,
			stmt,
			operands(stmt),
			env);
	} else if (is_application(stmt)) {
		var fun = evaluate(input_text,operator(stmt),env);
		var args = list_of_values(input_text,operands(stmt),env);
		var context = object(stmt) ? evaluate(input_text,object(stmt),env) : window;

		// We need to be careful. If we are calling debug() then we need
		// to give the environment to throw.
		if (fun === debug_break) {
			debug_break(env, stmt_line(stmt));
			// no return, exception thrown
		} else {
			return apply(fun, args, context);
		}
	} else if (is_object_method_application(stmt)) {
		var obj = object(stmt) ? evaluate(input_text,object(stmt),env) : window;
		if (!is_object(obj)) {
			error('Cannot apply object method on non-object');
		} else {
			var op = evaluate_object_property_access(obj,
				evaluate(input_text, object_property(stmt), env));
			return apply(op,
				list_of_values(input_text, operands(stmt), env),
				obj);
		}
	} else if (is_break_statement(stmt)) {
		return make_break_value();
	} else if (is_continue_statement(stmt)) {
		return make_continue_value();
	} else if (is_return_statement(stmt)) {
		//Tail-call optimisation.
		//Tail-calls are return statements which have no deferred operations,
		//and they return the result of another function call.
		if (is_application(return_statement_expression(stmt)) &&
					is_variable(operator(return_statement_expression(stmt)))) {
			//Over here, if our return expression is simply an expression, we return
			//a deferred evaluation. Apply will see these, and run it in a while
			//loop instead.
			//
			//To make Apply homogenous, we need to do some voodoo to evaluate
			//the operands in the function application, but NOT actually apply
			//the function.
			var fun = evaluate(input_text,operator(return_statement_expression(stmt)), env);
			var arguments = list_of_values(input_text,operands(return_statement_expression(stmt)), env);
			var obj = object(stmt) ? evaluate(input_text,object(return_statement_expression(stmt)), env) : window;
			return make_tail_recursive_return_value(fun, arguments, obj, env);
		} else {
			return make_return_value(
				evaluate(input_text,return_statement_expression(stmt),
				env));
		}
	} else if (is_array_expression(stmt)) {
		return evaluate_array_expression(input_text,stmt,env);
	} else if (is_object_expression(stmt)) {
		return evaluate_object_expression(input_text,stmt,env);
	} else if (is_construction(stmt)) {
		return evaluate_construction_statement(input_text,stmt,env);
	} else if (is_property_access(stmt)) {
		return evaluate_property_access(input_text,stmt,env);
	} else if (is_property_assignment(stmt)) {
		return evaluate_property_assignment(input_text,stmt,env);
	} else {
		error("Unknown expression type: " + JSON.stringify(stmt),
			stmt_line(stmt));
	}
}

function evaluate_toplevel(input_text,stmt,env) {
	var value = evaluate(input_text,stmt,env);
	if (is_return_value(value) || is_tail_recursive_return_value(value)) {
		error("return not allowed outside of function definition");
	} else if (is_break_value(value) || is_continue_value(value)) {
		error("break and continue not allowed outside of function.");
	} else {
		return value;
	}
}

/// The top-level environment.
var the_global_environment = (function() {
	var initial_env = extend_environment(primitive_function_names(),
		primitive_function_objects(),
		the_empty_environment);
	define_variable("undefined", make_undefined_value(), initial_env);
	define_variable("NaN", NaN, initial_env);
	define_variable("Infinity", Infinity, initial_env);
	define_variable("window", window, initial_env);
	define_variable("debug", debug_break, initial_env);
	define_variable("debug_resume",
		make_primitive_function_object(debug_resume),
		initial_env);
	return initial_env;
})();

/// For initialising /other/ toplevel environments.
///
/// By default this is the global environment. However, if a program forces early
/// termination, we will install the current environment so that we can evaluate
/// expressions in the "debug" environment. This allows debugging.
var environment_stack = [the_global_environment];
environment_stack.top = function() {
	if (this.length === 0) {
		return null;
	} else {
		return this[this.length - 1];
	}
};

function driver_loop() {
	var program_string = read("Enter your program here: ");
	var program_syntax = parse(program_string);
	if (is_tagged_object(program_syntax,"exit")) {
		return "interpreter completed";
	} else {
		var output = evaluate_toplevel(
			string.replace(new RegExp('\r\n', 'g'), '\n').replace(new RegExp('\r', 'g'), '\n').split('\n'),
			program_syntax, environment_stack.top());
		write(output);
		return driver_loop();
	}
}

function get_input_text(input_text, start_line, start_col, end_line, end_col) {
	//Fix index-from-line 1
	start_line = start_line - 1;
	end_line = end_line - 1;

	if (start_line === end_line) {
		return input_text[start_line].substr(start_col, end_col - start_col + 1);
	} else {
		var result = '';
		var i = start_line;
		result = result + input_text[start_line].substr(start_col) + '\n';
		
		for (i = i + 1; i < end_line; i = i + 1) {
			result = result + input_text[i] + '\n';
		}
		
		result = result + input_text[end_line].substr(0, end_col + 1);
		return result;
	}
}

/// \section Debugging support
function DebugException(environment, line) {
	this.environment = environment;
	this.line = line;
}

/// The registered debug handler. If this is set, when debug_break is called,
/// this handler will get triggered with the line number of the triggering
/// call.
var debug_handler = null;

/// Breaks the interpreter, throwing the environment to the top level.
function debug_break(env, line) {
	throw new DebugException(env, line);
}

/// Handles the exception generated by debug_break, installing it to
/// the top level.
function debug_handle(exception) {
	environment_stack.push(exception.environment);
	console.warn("Debugger environment initialised.");

	if (debug_handler) {
		debug_handler(exception.line);
	}
}

/// Removes the top environment from the environment stack.
function debug_resume() {
	if (environment_stack.length > 1) {
		environment_stack.pop();
		console.log("Environment restored.");

		if (environment_stack.length === 1 && debug_handler) {
			debug_handler(null);
		}
	} else {
		console.log("No environments to restore.");
	}
}

function debug_evaluate_toplevel() {
	try {
		return evaluate_toplevel.apply(this, arguments);
	} catch (e) {
		if (e instanceof DebugException) {
			debug_handle(e);
		} else {
			throw e;
		}
	}
}

//Public functions
/// Parses and evaluates the given program source text, with an optional timeout
/// where an exception (time limit exceeded) is thrown.
/// \param[in] string The program text string to run as the program code.
/// \param[in] timeout The timeout in milliseconds before code execution is
///                    interrupted.
parse_and_evaluate = function(string, timeout) {
	if (timeout) {
		expires = (new Date()).getTime() + timeout;
	} else {
		expires = undefined;
	}
	
	var result = debug_evaluate_toplevel(
		string.replace(new RegExp('\r\n', 'g'), '\n').replace(new RegExp('\r', 'g'), '\n').split('\n'),
		parse(string),
		environment_stack.top());

	// Reset the timeout.
	expires = undefined;
	return result;
};

parser_register_native_function = function(name, func) {
	if (!is_function(func) && !is_primitive_function(func)) {
		error("parser_register_native_function can only be used to register " +
			"functions: " + JSON.stringify(func) + " given.");
	} else if (is_primitive_function(func)) {
		//No need to wrap another layer of indirection
		add_binding_to_frame(name, func,
			first_frame(the_global_environment));
	} else {
		add_binding_to_frame(name, make_primitive_function_object(func),
			first_frame(the_global_environment));
	}
};

parser_register_native_variable = function(name, object) {
	if (is_object(object) && is_function(object)) {
		error("parser_register_native_variable can only be used to register " +
			"variables.");
	} else {
		define_variable(name, object, the_global_environment);
	}
};

parser_register_debug_handler = function(handler) {
	debug_handler = handler;
}

})();
