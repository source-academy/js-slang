{{
    function buildInteger(str, base) {
        // note: we discard the "_" delimiters
        return parseInt(str.replaceAll("_", ""), base)
    }

    function buildLiteral(value) {
        return {
            type: "Literal",
            value: value
        };
    }
    
    function buildBinaryExpression(head, tail) {
        return tail.reduce(function(result, element) {
            return {
                type: "BinaryExpression",
                operator: element[1],
                left: result,
                right: element[3]
            };
        }, head);
    }
}}

Start
    = Statement 

Statement
    =  SimpleStatement

SimpleStatement
    = ExpressionStatement

ExpressionStatement
   = expression: Expression { 
        return { type: "ExpressionStatement", expression: expression } 
     }

Expression
    = RelationalExpression 

PrimaryExpression
    = Literal
    / "(" _ expression: Expression _ ")" { return expression }

Literal
    = BasicLit
 
BasicLit
    = IntegerLit

IntegerLit "integer"
    = HexInt 
    / OctalInt 
    / BinaryInt 
    / DecimalInt

DecimalInt "decimal"
    = "0" { return buildLiteral(0); } 
 	/ [1-9] DecimalDigit* {
        return buildLiteral(buildInteger(text(), 10))
   	  }

BinaryInt "binary"
    = "0b"i digits:$BinaryDigit+ {
        return buildLiteral(buildInteger(digits, 2))
      }

OctalInt "octal"
    = "0" "o"i? digits:$OctalDigit+ {
        return buildLiteral(buildInteger(digits, 8))
      }

HexInt "hexadecimal"
    = "0x"i digits:$HexDigit+ {
        return buildLiteral(buildInteger(digits, 16))
      }
 
DecimalDigit
    = "_"? [0-9]

BinaryDigit
    = "_"? [0-1]
 
OctalDigit
    = "_"? [0-7]
 
HexDigit
    = "_"? [a-fA-F0-9]
 
UnaryExpression
    = PrimaryExpression
    / operator:UnaryOperator argument:UnaryExpression {
        return {type: "UnaryExpression", operator: operator, argument: argument}
 	  }
 
UnaryOperator
    = "+" 
    / "-"

MultiplicativeExpression
    = head:UnaryExpression
      tail:(_ MultiplicativeOperator _ UnaryExpression)*
      { return buildBinaryExpression(head, tail); }

MultiplicativeOperator
    = "*" 
    / "/" 
    / "%" 

AdditiveExpression
    = head:MultiplicativeExpression
      tail:(_ AdditiveOperator _ MultiplicativeExpression)*
      { return buildBinaryExpression(head, tail); }
 
AdditiveOperator
    = "+" 
    / "-" 
    / "|" 
    / "^"

RelationalExpression
    = head:AdditiveExpression
      tail:(_ RelationalOperator _ AdditiveExpression)*
      { return buildBinaryExpression(head, tail); }

RelationalOperator
    = "=="
    / "!="
    / "<=" 
    / "<" 
    / ">="
    / ">" 

/* Tokens */

BREAK_TOKEN         = "break"
DEFAULT_TOKEN       = "default"
FUNC_TOKEN          = "func"
INTERFACE_TOKEN     = "interface"
SELECT_TOKEN        = "select"
CASE_TOKEN          = "case"
DEFER_TOKEN         = "defer"
GO_TOKEN            = "go"
MAP_TOKEN           = "map"
STRUCT_TOKEN        = "struct"
CHAN_TOKEN          = "chan"
ELSE_TOKEN          = "else"
GOTO_TOKEN          = "goto"
PACKAGE_TOKEN       = "package"
SWITCH_TOKEN        = "switch"
CONST_TOKEN         = "const"
FALLTHROUGH_TOKEN   = "fallthrough"
IF_TOKEN            = "if"
RANGE_TOKEN         = "range"
TYPE_TOKEN          = "type"
CONTINUE_TOKEN      = "continue"
FOR_TOKEN           = "for"
IMPORT_TOKEN        = "import"
RETURN_TOKEN        = "return"
VAR_TOKEN           = "var"

Keyword
    = BREAK_TOKEN    
    / DEFAULT_TOKEN
    / FUNC_TOKEN
    / INTERFACE_TOKEN
    / SELECT_TOKEN
    / CASE_TOKEN
    / DEFER_TOKEN
    / GO_TOKEN
    / MAP_TOKEN
    / STRUCT_TOKEN
    / CHAN_TOKEN
    / ELSE_TOKEN
    / GOTO_TOKEN
    / PACKAGE_TOKEN
    / SWITCH_TOKEN
    / CONST_TOKEN  
    / FALLTHROUGH_TOKEN
    / IF_TOKEN
    / RANGE_TOKEN
    / TYPE_TOKEN    
    / CONTINUE_TOKEN
    / FOR_TOKEN 
    / IMPORT_TOKEN
    / RETURN_TOKEN   
    / VAR_TOKEN   

/* Separators */

_  "whitespace" = [ \t\r\n]* // optional whitespace
__ "whitespace" = [ \t\r\n]+ // required whitespace
