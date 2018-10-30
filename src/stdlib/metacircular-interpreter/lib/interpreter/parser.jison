
/* description: Parses end executes JediScript expressions. */

/* lexical grammar */
%lex
%x DoubleQuotedString
%x SingleQuotedString
%x QuotedStringEscape
%%


\/\/([^\n\r]*)              /* skip single-line comments */
\/\*([\u0000-\uffff]*?)\*\/ /* skip multi-line comments */
\s+                         /* skip whitespace */

"function"                                    return 'function'
"return"                                      return 'return'
"if"                                          return 'if'
"else"                                        return 'else'
"while"                                       return 'while'
"for"                                         return 'for'
"break"                                       return 'break'
"continue"                                    return 'continue'
"let"                                         return 'let'
"const"                                       return 'const'
"==="                                         return '==='
"=>"                                          return '=>'
"="                                           return '='
"{"                                           return '{'
"}"                                           return '}'
";"                                           return ';'
","                                           return ','
"true"                                        return 'true'
"false"                                       return 'false'
"NaN"                                         return 'NaN'
"Infinity"                                    return 'Infinity'
"[]"                                          return 'emptylist'
"["                                           return '['
"]"                                           return ']'
"."                                           return '.'

'""'                                          return 'EmptyString'
"''"                                          return 'EmptyString'
'"'                                           this.begin('DoubleQuotedString');
"'"                                           this.begin('SingleQuotedString');
<DoubleQuotedString,SingleQuotedString>\\     this.begin('QuotedStringEscape');
<DoubleQuotedString>'"'                       this.popState();
<SingleQuotedString>"'"                       this.popState();
<QuotedStringEscape>(.|\r\n|\n)               { this.popState(); return 'QuotedStringEscape'; } /* The newlines are there because we can span strings across lines using \ */
<DoubleQuotedString>[^"\\]*                   return 'QuotedString';
<SingleQuotedString>[^'\\]*                   return 'QuotedString';


[A-Za-z_][A-Za-z0-9_]*                        return 'Identifier' /* TODO: non-ASCII identifiers */

[0-9]+("."[0-9]+)?([eE][\-+]?[0-9]+)?\b       return 'FLOAT_NUMBER' /* 3.1, 3.1e-7 */
[0-9]+\b                                      return 'INT_NUMBER'

"+"                                           return '+'
"-"                                           return '-'
"*"                                           return '*'
"/"                                           return '/'
"%"                                           return '%'
"!=="                                         return '!=='
"<="                                          return '<='
">="                                          return '>='
"<"                                           return '<'
">"                                           return '>'
"!"                                           return '!'
"&&"                                          return '&&'
"||"                                          return '||'
"("                                           return '('
")"                                           return ')'
"?"                                           return '?'
":"                                           return ':'

<<EOF>>                                       return 'EOF'
.                                             return 'INVALID'

/lex

/* operator associations and precedence */

%left  ';'
%right '='
%left  '=>' ARROW
%right '?' ':'
%left  '||'
%left  '&&'
%left  '===' '!=='
%left  '<' '>' '<=' '>='
%left  '+' '-'
%left  '*' '/' '%'
%right '!' UMINUS UPLUS
%left  '[' ']'
%left  '.'

%% /* language grammar */

program
	: statements EOF
		{ return $1; }
	;

statements
	:
		{ $$ = []; }
	| ';' /* The empty statement */
		{ $$ = []; }
	| statement statements
		{ $$ = pair($1, $2); }
	;

statement
	:
	ifstatement

	| whilestatement

	| forstatement


	| 'function' identifier '(' identifiers ')' '{' statements '}'
		{{
			$$ = {
				tag: 'constant_declaration',
				name: $2,
				value: {
					tag: 'function_definition',
					parameters: $4,
					body: $7,
					line: yylineno,
					location: {
						start_line: @1.first_line,
						start_col: @1.first_column,
						end_line: @8.first_line,
						end_col: @8.first_column
					}
				},
				line: yylineno
			};
		}}
	| constdeclaration
	| letdeclaration
	| '{' statements '}'
	      {{
			$$ = {
			         tag: 'block',
				 body: $2
 			     };
	      }}

	| assignment ';'

	| expression ';'
	| 'return' expression ';'
		{{
			$$ = {
				tag: 'return_statement',
				expression: $2,
				line: yylineno
			};
		}}

	| break ';'
		{{
			$$ = {
				tag: 'break_statement',
				line: yylineno
			};
		}}
	| continue ';'
		{{
			$$ = {
				tag: 'continue_statement',
				line: yylineno
			};
		}}

	;

letdeclaration
	:
	'let' identifier '=' expression ';'
		{{
			$$ = {
				tag: 'variable_declaration',
				name: $2,
				value: $4,
				line: yylineno
			};
		}}
	;

constdeclaration
	:
	'const' identifier '=' expression ';'
		{{
			$$ = {
				tag: 'constant_declaration',
				name: $2,
				value: $4,
				line: yylineno
			};
		}}
	;


assignment
	:
	expression '=' expression
		{{
			if ($1.tag === 'name') {
				$$ = {
					tag: 'assignment',
					name: $1,
					value: $3,
					line: yylineno
				};

			} else if ($1.tag === 'property_access') {
				$$ = {
					tag: 'property_assignment',
					object: $1.object,
					property: $1.property,
					value: $3,
					line: yylineno
				};

			} else {
				error('parse error in line ' + yylineno + ": " + yytext);
			}
		}}
	;

ifstatement
	:
	'if' '(' expression ')' '{' statements '}' 'else' '{' statements '}'
		{{
			$$ = {
				tag: 'conditional_statement',
				predicate: $3,
				consequent: { tag: 'block', body: $6 },
				alternative: { tag: 'block', body: $10 },
				line: yylineno
			};
		}}
	| 'if' '(' expression ')' '{' statements '}' 'else' ifstatement
		{{
			$$ = {
				tag: 'conditional_statement',
				predicate: $3,
				consequent: { tag: 'block', body: $6 },
				alternative: pair($9, []),
				line: yylineno
			};
		}}
	;


whilestatement
	:
	'while' '(' expression ')' '{' statements '}'
		{{
			$$ = {
				tag: 'while_loop',
				predicate: $3,
				statements: { tag: 'block', body: $6 },
				line: yylineno
			};
		}}
	;

forstatement
	:
		'for' '(' forinitialiser expression ';' forfinaliser ')' '{' statements '}'
		{{
			$$ = {
				tag: 'for_loop',
				initialiser: $3,
				predicate: $4,
				finaliser: $6,
				statements: { tag: 'block', body: $9 },
				line: yylineno
			};
		}}
	;

forinitialiser
	:
	letdeclaration
	| assignment ';'
	;

forfinaliser
	:
	assignment
	;


expression
	:
	expression '+' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '-' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '*' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '/' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '%' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| '-' expression %prec UMINUS
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $1,
					line: yylineno
				},
				operands: [0, [$2, []]],
				line: yylineno
			};
		}}
	| '+' expression %prec UPLUS
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $1,
					line: yylineno
				},
				operands: [0, [$2, []]],
				line: yylineno
			};
		}}
	| '!' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $1,
					line: yylineno
				},
				operands: [$2, []],
				line: yylineno
			};
		}}
	| expression '&&' expression
		{{
			$$ = {
				tag: 'boolean_operation',
				operator: $2,
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '||' expression
		{{
			$$ = {
				tag: 'boolean_operation',
				operator: $2,
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '===' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '!==' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '>' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '<' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '>=' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '<=' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| '(' identifiers ')' '=>' expression    %prec ARROW
		{{
			$$ = {
				tag: 'function_definition',
				parameters: $2,
				body: { tag: 'return_statement', expression: $5,
					line: yylineno },
				line: yylineno,
				location: {
					start_line: @1.first_line,
					start_col: @1.first_column,
					end_line: @5.first_line,
					end_col: @5.first_column
			     	}
			};
		}}
	| expression '=>' expression
		{{
		             if ($1.tag === 'name) {
			        $$ = {
				   tag: 'function_definition',
				   parameters: [$1, [] ],
				   body: { tag: 'return_statement', expression: $3,
					   line: yylineno },
				   line: yylineno,
				   location: {
					start_line: @1.first_line,
					start_col: @1.first_column,
					end_line: @5.first_line,
					end_col: @5.first_column
			     	};
			     } else {
				error('expecting name before => ' + yylineno + ": " + yytext);
			     }
		}}

	| expression '[' expression ']'
		{{
			$$ = {
				tag: 'property_access',
				object: $1,
				property: $3,
				line: yylineno
			};
		}}


	/* Because we need to use the Math library. */
	| expression '.' identifier
		{{
			$$ = {
				tag: 'property_access',
				object: $1,
				property: $3,
				line: yylineno
			};
		}}

	| '(' expression ')'
		{$$ = $2;}

	| constants

	| identifier
		{{
			$$ = {
				tag: 'name',
				name: $1,
				line: yylineno
			};
		}}

	| '(' expression ')' '(' expressions ')'
		{{
			$$ = {
				tag: 'application',
				operator: $2,
				operands: $5,
				line: yylineno
			};
		}}

	| '[' expressions ']'
		{{
			$$ = {
				tag: 'array_expression',
				elements: $2,
				line: yylineno
			};
		}}
	| '{' pairs '}'
		{{
			$$ = {
				tag: 'object_expression',
				pairs: $2,
				line: yylineno
			};
		}}

	| identifier '(' expressions ')'
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'name',
					name: $1,
					line: yylineno
				},
				operands: $3,
				line: yylineno
			};
		}}

	| expression '?' expression ':' expression
		{{
			$$ = {
				tag: 'conditional_expression',
				predicate: $1,
				consequent: $3,
				alternative: $5,
				line: yylineno
			};
		}}
	;

constants
	:
	'FLOAT_NUMBER'
		{ $$ = parseFloat(yytext); }

	| 'INT_NUMBER'
		{ $$ = parseInt(yytext, 10); }

	| 'true'
		{ $$ = true; }

	| 'false'
		{ $$ = false; }

	| 'NaN'
		{ $$ = NaN; }

	| 'Infinity'
		{ $$ = Infinity; }

	| quotedstring

	| 'emptylist'
		{ $$ = { tag: 'empty_list', line: yylineno }; }
	;

quotedstring
	:
	  'EmptyString'
	{
		$$ = '';
	}
	| 'QuotedString'
	| 'QuotedStringEscape'
	{
		switch (yytext)
		{
			case 'b':		$$ = '\b'; break;
			case 'n':		$$ = '\n'; break;
			case 'r':		$$ = '\r'; break;
			case 't':		$$ = '\t'; break;
			case "'":		$$ = "'"; break;
			case '"':		$$ = '"'; break;
			case '\\':		$$ = '\\'; break;
			case '\n':
			case '\r\n':	$$ = ''; break;
			default:		$$ = '\\' + $1; break;
		}
	}
	| 'QuotedStringEscape' quotedstring
	{
		switch ($1)
		{
			case 'b':		$$ = '\b'; break;
			case 'n':		$$ = '\n'; break;
			case 'r':		$$ = '\r'; break;
			case 't':		$$ = '\t'; break;
			case "'":		$$ = "'"; break;
			case '"':		$$ = '"'; break;
			case '\\':		$$ = '\\'; break;
			case '\n':
			case '\r\n':	$$ = ''; break;
			default:		$$ = '\\' + $1; break;
		}
		$$ += $2;
	}
	| 'QuotedString' quotedstring
	{
		$$ = $1 + $2;
	}
	;

expressions
	:
	nonemptyexpressions
		{ $$ = $1; }
	| /* NOTHING */
		{ $$ = []; }
	;

nonemptyexpressions
	:
	expression ',' nonemptyexpressions
		{ $$ = [ $1, $3 ]; }
	| expression
		{ $$ = [ $1, [] ]; }
	;


pairs
	:
	nonemptypairs
		{ $$ = $1; }
	| /* NOTHING */
		{ $$ = []; }
	;

nonemptypairs
	:
	pair ',' nonemptypairs
		{ $$ = [ $1, $3 ]; }
	| pair
		{ $$ = [ $1, [] ]; }
	;

pair
	:
	identifier ':' expression
		{ $$ = [ $1, $3 ]; }
	;

identifiers
	:
	nonemptyidentifiers
		{ $$ = $1; }
	| /* NOTHING */
		{ $$ = []; }
	;

nonemptyidentifiers
	:
	identifier ',' nonemptyidentifiers
		{ $$ = [ $1, $3 ]; }
	| identifier
		{ $$ = [ $1, [] ]; }
	;

identifier
	:
	'Identifier'
		{ $$ = yytext; }
	;
