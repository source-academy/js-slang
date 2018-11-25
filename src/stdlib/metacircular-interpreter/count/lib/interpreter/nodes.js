/*globals define*/
/** @module nodes
 *  Functions for manipulating a JediScript AST.
 *  @author Joel Low <joel.low@nus.edu.sg>
 */
    function is_null(xs) {
        return xs === null;
    }

    function is_undefined_value(value) {
        return value === undefined;
    }

    function is_number(xs) {
        return typeof xs === 'number';
    }

    function is_NaN(x) {
        return is_number(x) && isNaN(x);
    }

    function is_string(xs) {
        return typeof xs === 'string';
    }

    function is_boolean(xs) {
        return typeof xs === 'boolean';
    }

    function is_object(xs) {
        return typeof xs === 'object' || is_function(xs);
    }

    function is_array(xs) {
        return is_object(xs) && (xs instanceof Array);
    }

    function pair(a, b) {
        return [a, b];
    }

    function is_empty_list(pr) {
        return is_pair(pr) && pr.length === 0;
    }

    function head(pr) {
        if (is_pair(pr) && !is_empty_list(pr)) {
            return pr[0];
        } else {
            return undefined;
        }
    }

    function tail(pr) {
        if (is_pair(pr) && !is_empty_list(pr)) {
            return pr[1];
        } else {
            return undefined;
        }
    }

    function is_pair(xs) {
        return is_array(xs) && (xs.length === 0 || xs.length === 2);
    }

    function is_list(xs) {
        return is_pair(xs) && (is_empty_list(xs) || is_list(tail(xs)));
    }

    function is_function(xs) {
        return typeof xs === 'function';
    }

    function is_tagged_object(object, tag) {
        return is_object(object) && object.tag === tag;
    }

    module.exports = {
        stmt_line: function(stmt) {
            return stmt.line;
        },

        is_undefined_value: is_undefined_value,
        is_number: is_number,
        is_string: is_string,
        is_boolean: is_boolean,
        pair: pair,
        is_empty_list: is_empty_list,
        head: head,
        tail: tail,

        no_op: function() {
            return null;
        },

        is_sequence: is_list,
        empty_stmt: is_empty_list,
        last_stmt: function(stmts) {
            return is_empty_list(tail(stmts));
        },
        first_stmt: head,
        rest_stmts: tail,

        if_statement: function(predicate, consequent, alternative, line_number) {
            return {
                tag: 'if',
                predicate: predicate,
                consequent: consequent,
                alternative: alternative,
                line: line_number
            };
        },

        is_if_statement: function(stmt) {
            return is_tagged_object(stmt, 'if');
        },

        if_predicate: function(stmt) {
            return stmt.predicate;
        },

        if_consequent: function(stmt) {
            return stmt.consequent;
        },

        if_alternative: function(stmt) {
            return stmt.alternative;
        },

        while_statement: function(predicate, statements, line_number) {
            return {
                tag: 'while',
                predicate: predicate,
                statements: statements,
                line: line_number
            };
        },

        is_while_statement: function(stmt) {
            return is_tagged_object(stmt, 'while');
        },

        while_predicate: function(stmt) {
            return stmt.predicate;
        },

        while_statements: function(stmt) {
            return stmt.statements;
        },

        for_statement: function(initialiser, predicate, finaliser, statements, line_number) {
            return {
                tag: 'for',
                initialiser: initialiser,
                predicate: predicate,
                finaliser: finaliser,
                statements: statements,
                line: line_number
            };
        },

        is_for_statement: function(stmt) {
            return is_tagged_object(stmt, 'for');
        },

        for_initialiser: function(stmt) {
            return stmt.initialiser;
        },

        for_predicate: function(stmt) {
            return stmt.predicate;
        },

        for_finaliser: function(stmt) {
            return stmt.finaliser;
        },

        for_statements: function(stmt) {
            return stmt.statements;
        },

        break_statement: function(line_number) {
            return {
                tag: 'break_statement',
                line: line_number
            };
        },

        is_break_statement: function(stmt) {
            return is_tagged_object(stmt, 'break_statement');
        },

        continue_statement: function(line_number) {
            return {
                tag: 'continue_statement',
                line: line_number
            };
        },

        is_continue_statement: function(stmt) {
            return is_tagged_object(stmt, 'continue_statement');
        },

        function_definition: function(identifier, parameters, statements, start_token, end_token) {
            return {
                tag: 'function_definition',
                name: identifier,
                parameters: parameters,
                body: statements,
                location: {
                    start_line: start_token.first_line,
                    start_col: start_token.first_column,
                    start_offset: start_token.range[0],
                    end_line: end_token.last_line,
                    end_col: end_token.last_column,
                    end_offset: end_token.range[1]
                },
                line: end_token.last_line - 1
            };
        },

        is_function_definition: function(stmt) {
            return is_tagged_object(stmt, 'function_definition');
        },

        function_definition_name: function(stmt) {
            return stmt.name;
        },

        function_definition_parameters: function(stmt) {
            return stmt.parameters;
        },

        function_definition_body: function(stmt) {
            return stmt.body;
        },

        function_definition_text_location: function(stmt) {
            return stmt.location;
        },

        return_statement: function(expression, line_number) {
            return {
                tag: 'return_statement',
                expression: expression,
                line: line_number
            };
        },

        is_return_statement: function(stmt) {
            return is_tagged_object(stmt, 'return_statement');
        },

        return_statement_expression: function(stmt) {
            return stmt.expression;
        },

        variable_definition: function(identifier, expression, line_number) {
            return {
                tag: 'var_definition',
                variable: identifier,
                value: expression,
                line: line_number
            };
        },

        is_var_definition: function(stmt) {
            return is_tagged_object(stmt, 'var_definition');
        },

        var_definition_variable: function(stmt) {
            return stmt.variable;
        },

        var_definition_value: function(stmt) {
            return stmt.value;
        },

        assignment: function(variable, expression, line_number) {
            return {
                tag: 'assignment',
                variable: variable,
                value: expression,
                line: line_number
            };
        },

        is_assignment: function(stmt) {
            return is_tagged_object(stmt, 'assignment');
        },

        assignment_variable: function(stmt) {
            return stmt.variable;
        },

        assignment_value: function(stmt) {
            return stmt.value;
        },

        property_assignment: function(object, property, expression, line_number) {
            return {
                tag: 'property_assignment',
                object: object,
                property: property,
                value: expression,
                line: line_number
            };
        },

        is_property_assignment: function(stmt) {
            return is_tagged_object(stmt, 'property_assignment');
        },

        property_assignment_object: function(stmt) {
            return stmt.object;
        },

        property_assignment_property: function(stmt) {
            return stmt.property;
        },

        property_assignment_value: function(stmt) {
            return stmt.value;
        },

        eager_binary_expression: function(lhs, op, rhs, line_number) {
            return this.application(this.variable(op, line_number), [lhs, [rhs, []]], line_number);
        },

        eager_unary_expression: function(op, expr, line_number) {
            return this.application(this.variable(op, line_number), [expr, []], line_number);
        },

        boolean_operation: function(lhs, op, rhs, line_number) {
            return {
                tag: 'boolean_op',
                operator: op,
                operands: [lhs, [rhs, []]],
                line: line_number
            };
        },

        is_boolean_operation: function(stmt) {
            return is_tagged_object(stmt, 'boolean_op');
        },

        property_access: function(object, property, line_number) {
            return {
                tag: 'property_access',
                object: object,
                property: property,
                line: line_number
            };
        },

        is_property_access: function(stmt) {
            return is_tagged_object(stmt, 'property_access');
        },

        property_access_object: function(stmt) {
            return stmt.object;
        },

        property_access_property: function(stmt) {
            return stmt.property;
        },

        variable: function(identifier, line_number) {
            return {
                tag: 'variable',
                name: identifier,
                line: line_number
            };
        },

        is_variable: function(stmt) {
            return is_tagged_object(stmt, 'variable');
        },

        variable_name: function(stmt) {
            return stmt.name;
        },

        application: function(operator, operands, line_number) {
            return {
                tag: 'application',
                operator: operator,
                operands: operands,
                line: line_number
            };
        },

        is_application: function(stmt) {
            return is_tagged_object(stmt, 'application');
        },

        operator: function(stmt) {
            return stmt.operator;
        },

        operands: function(stmt) {
            return stmt.operands;
        },

        no_operands: is_empty_list,
        first_operand: head,
        rest_operands: tail,

        object_method_application: function(object, property, operands, line_number) {
            return {
                tag: 'object_method_application',
                object: object,
                property: property,
                operands: operands,
                line: line_number
            };
        },

        is_object_method_application: function(stmt) {
            return is_tagged_object(stmt, 'object_method_application');
        },

        object: function(stmt) {
            return stmt.object;
        },

        object_property: function(stmt) {
            return stmt.property;
        },

        construction: function(type, operands, line_number) {
            return {
                tag: 'construction',
                type: type,
                operands: operands,
                line: line_number
            };
        },

        is_construction: function(stmt) {
            return is_tagged_object(stmt, 'construction');
        },

        construction_type: function(stmt) {
            return stmt.type;
        },

        ternary: function(predicate, consequent, alternative, line_number) {
            return {
                tag: 'ternary',
                predicate: predicate,
                consequent: consequent,
                alternative: alternative,
                line: line_number
            };
        },

        is_ternary_statement: function(stmt) {
            return is_tagged_object(stmt, 'ternary');
        },

        ternary_predicate: function(stmt) {
            return stmt.predicate;
        },

        ternary_consequent: function(stmt) {
            return stmt.consequent;
        },

        ternary_alternative: function(stmt) {
            return stmt.alternative;
        },

        is_self_evaluating: function(stmt) {
            return is_number(stmt) || is_string(stmt) || is_boolean(stmt);
        },

        empty_list: function(line_number) {
            return {
                tag: 'empty_list',
                line: line_number
            };
        },

        is_empty_list_statement: function(stmt) {
            return is_tagged_object(stmt, 'empty_list');
        },

        array_literal: function(elements, line_number) {
            return {
                tag: 'arrayinit',
                elements: elements,
                line: line_number
            };
        },

        is_array_expression: function(stmt) {
            return is_tagged_object(stmt, 'arrayinit');
        },

        array_expression_elements: function(stmt) {
            return stmt.elements;
        },

        first_array_element: head,
        rest_array_elements: tail,
        empty_array_element: is_empty_list,

        object_literal: function(statements, line_number) {
            return {
                tag: 'object',
                pairs: statements,
                line: line_number
            };
        },

        is_object_expression: function(stmt) {
            return is_tagged_object(stmt, 'object');
        },

        object_expression_pairs: function(stmt) {
            return stmt.pairs;
        },

        first_object_expression_pair: head,
        rest_object_expression_pairs: tail,
        empty_object_expression_pairs: is_empty_list,
        object_expression_pair_key: head,
        object_expression_pair_value: tail
    };

