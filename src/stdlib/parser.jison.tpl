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
"case"                                        return 'case'
"default"                                     return 'default'
"new"                                         return 'new'
"break"                                       return 'break'
"continue"                                    return 'continue'
"var"                                         return 'var'
"==="                                         return '==='
"="                                           return '='
"{"                                           return '{'
"}"                                           return '}'
";"                                           return ';'
","                                           return ','
"true"                                        return 'true'
"false"                                       return 'false'
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
	| '{' statements '}'
		{ $$ = $2; }
	;

statement
	:
	ifstatement
{{if week|ormore>8}}
	| whilestatement
{{if week|ormore>13}}
	| forstatement
{{/if}}
{{/if}}
	| 'function' identifier '(' identifiers ')' '{' statements '}'
		{{
			$$ = {
				tag: 'var_definition',
				variable: $2,
				value: {
					tag: 'function_definition',
					name: $2,
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
	| vardefinition
{{if week|ormore>8}}
	| assignment ';'
{{/if}}
	| expression ';'
	| 'return' expression ';'
		{{
			$$ = {
				tag: 'return_statement',
				expression: $2,
				line: yylineno
			};
		}}
{{if week|ormore>13}}
	| break ';'
		{{
			$$$ = {
				tag: 'break_statement',
				line: yylineno
			};
		}}
	| continue ';'
		{{
			$$$ = {
				tag: 'continue_statement',
				line: yylineno
			};
		}}
{{/if}}
	;

vardefinition
	:
	'var' identifier '=' expression ';'
		{{
			$$ = {
				tag: 'var_definition',
				variable: $2,
				value: $4,
				line: yylineno
			};
		}}
	;

{{if week|ormore>8}}
assignment
	:
	expression '=' expression
		{{
			if ($1.tag === 'variable') {
				$$$ = {
					tag: 'assignment',
					variable: $1,
					value: $3,
					line: yylineno
				};
{{if week|ormore>10}}
			} else if ($1.tag === 'property_access') {
				$$$$$$ = {
					tag: 'property_assignment',
					object: $1.object,
					property: $1.property,
					value: $3,
					line: yylineno
				};
{{/if}}
			} else {
				error('parse error in line ' + yylineno + ": " + yytext);
			}
		}}
	;
{{/if}}
ifstatement
	:
	'if' '(' expression ')' '{' statements '}' 'else' '{' statements '}'
		{{
			$$ = {
				tag: 'if',
				predicate: $3,
				consequent: $6,
				alternative: $10,
				line: yylineno
			};
		}}
	| 'if' '(' expression ')' '{' statements '}' 'else' ifstatement
		{{
			$$ = {
				tag: 'if',
				predicate: $3,
				consequent: $6,
				alternative: pair($9, []),
				line: yylineno
			};
		}}
	;

{{if week|ormore>8}}
whilestatement
	:
	'while' '(' expression ')' '{' statements '}'
		{{
			$$$ = {
				tag: 'while',
				predicate: $3,
				statements: $6,
				line: yylineno
			};
		}}
	;

forstatement
	:
		'for' '(' forinitialiser expression ';' forfinaliser ')' '{' statements '}'
		{{
			$$$ = {
				tag: 'for',
				initialiser: $3,
				predicate: $4,
				finaliser: $6,
				statements: $9,
				line: yylineno
			};
		}}
	;

forinitialiser
	:
	expression ';'
	| vardefinition
	| assignment ';'
	| ';'
	;

forfinaliser
	:
	assignment
	| expression
	|
	;
{{/if}}

expression
	:
	expression '+' expression
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
				tag: 'boolean_op',
				operator: $2,
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
	| expression '||' expression
		{{
			$$ = {
				tag: 'boolean_op',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
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
					tag: 'variable',
					name: $2,
					line: yylineno
				},
				operands: [$1, [$3, []]],
				line: yylineno
			};
		}}
{{if week|ormore>10}}
	| expression '[' expression ']'
		{{
			$$$ = {
				tag: 'property_access',
				object: $1,
				property: $3,
				line: yylineno
			};
		}}
{{/if}}
{{if week|ormore>4}}
	/* Because we need to use the Math library. */
	| expression '.' identifier
		{{
			$$$ = {
				tag: 'property_access',
				object: $1,
				property: $3,
				line: yylineno
			};
		}}
{{/if}}
	| '(' expression ')'
		{$$ = $2;}

	| constants

	| identifier
		{{
			$$ = {
				tag: 'variable',
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
{{if week|ormore>10}}
	| '[' expressions ']'
		{{
			$$$ = {
				tag: 'arrayinit',
				elements: $2,
				line: yylineno
			};
		}}
	| '{' pairs '}'
		{{
			$$$ = {
				tag: 'object',
				pairs: $2,
				line: yylineno
			};
		}}
{{/if}}
	| identifier '(' expressions ')'
		{{
			$$ = {
				tag: 'application',
				operator: {
					tag: 'variable',
					name: $1,
					line: yylineno
				},
				operands: $3,
				line: yylineno
			};
		}}
{{if week|ormore>4}}
	| expression '.' identifier '(' expressions ')'
		{{
			$$$ = {
				tag: 'object_method_application',
				object: $1,
				property: $3,
				operands: $5,
				line: yylineno
			};
		}}
{{/if}}
{{if week|ormore>10}}
	| new identifier '(' expressions ')'
		{{
			$$$ = {
				tag: 'construction',
				type: $2,
				operands: $4,
				line: yylineno
			};
		}}
{{/if}}
	| 'function' '(' identifiers ')' '{' statements '}'
		{{
			$$ = {
				tag: 'function_definition',
				name: 'lambda',
				parameters: $3,
				body: $6,
				line: yylineno,
				location: {
					start_line: @1.first_line,
					start_col: @1.first_column,
					end_line: @7.first_line,
					end_col: @7.first_column
				}
			};
		}}

	| expression '?' expression ':' expression
		{{
			$$ = {
				tag: 'ternary',
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

{{if week|ormore>5}}
pairs
	:
	nonemptypairs
		{ $$$ = $1; }
	| /* NOTHING */
		{ $$$ = []; }
	;

nonemptypairs
	:
	pair ',' nonemptypairs
		{ $$$ = [ $1, $3 ]; }
	| pair
		{ $$$ = [ $1, [] ]; }
	;

pair
	:
	identifier ':' expression
		{ $$$ = [ $1, $3 ]; }
	;
{{/if}}
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
