{{
    function extractList(list, index) {
        return list.map(element => element[index]);
    }
    
    function buildList(head, tail, index) {
        return [head].concat(extractList(tail, index));
    }

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

SourceFile
    = topLevelDecls: TopLevelDeclaration* {
        return { type: "SourceFile", topLevelDecls }
      }

TopLevelDeclaration
    = Declaration

Statement
    = Declaration
    / SimpleStatement

Declaration
    = VariableDeclaration

SimpleStatement
    = ShortVariableDeclaration
    / ExpressionStatement

ExpressionStatement
   = expression: Expression { 
        return { type: "ExpressionStatement", expression: expression } 
     }

Expression
    = RelationalExpression 

PrimaryExpression
    = Identifier
    / Literal
    / "(" _ expression: Expression _ ")" { return expression }

Identifier
    = !Keyword Letter IdentifierPart* { 
        return { type: "Identifier", name: text() } 
      }

Letter
    = UnicodeLetter
    / "_"

IdentifierPart
    = Letter
    / UnicodeDigit

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

VariableDeclaration
    = VAR_TOKEN __ declarations:VarSpec EOS {
        return { type: "VariableDeclaration", ...declarations }
      }

VarSpec
    = ids:IdentifierList _ exprs:("=" _ ExpressionList)? {
        return { declarations: ids, expressions: exprs && exprs[2] }
      }

ShortVariableDeclaration
    = ids:IdentifierList _ ":=" _ exprs:ExpressionList {
        return { type: "VariableDeclaration", declarations: ids, expressions: exprs }
      }

IdentifierList
    = head:Identifier _ tail:(_ "," _ Identifier)* { return buildList(head, tail, 3); }

ExpressionList
    = head:Expression _ tail:(_ "," _ Expression)* { return buildList(head, tail, 3); }

/* Tokens */

BREAK_TOKEN         = "break"          !IdentifierPart
DEFAULT_TOKEN       = "default"        !IdentifierPart
FUNC_TOKEN          = "func"           !IdentifierPart
INTERFACE_TOKEN     = "interface"      !IdentifierPart
SELECT_TOKEN        = "select"         !IdentifierPart
CASE_TOKEN          = "case"           !IdentifierPart
DEFER_TOKEN         = "defer"          !IdentifierPart
GO_TOKEN            = "go"             !IdentifierPart
MAP_TOKEN           = "map"            !IdentifierPart
STRUCT_TOKEN        = "struct"         !IdentifierPart
CHAN_TOKEN          = "chan"           !IdentifierPart
ELSE_TOKEN          = "else"           !IdentifierPart
GOTO_TOKEN          = "goto"           !IdentifierPart
PACKAGE_TOKEN       = "package"        !IdentifierPart
SWITCH_TOKEN        = "switch"         !IdentifierPart
CONST_TOKEN         = "const"          !IdentifierPart
FALLTHROUGH_TOKEN   = "fallthrough"    !IdentifierPart
IF_TOKEN            = "if"             !IdentifierPart
RANGE_TOKEN         = "range"          !IdentifierPart
TYPE_TOKEN          = "type"           !IdentifierPart
CONTINUE_TOKEN      = "continue"       !IdentifierPart
FOR_TOKEN           = "for"            !IdentifierPart
IMPORT_TOKEN        = "import"         !IdentifierPart
RETURN_TOKEN        = "return"         !IdentifierPart
VAR_TOKEN           = "var"            !IdentifierPart

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

EOS
  = _ LineTerminatorSequence?

LineTerminatorSequence "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029"

_  "whitespace" = [ \t\r\n]* // optional whitespace
__ "whitespace" = [ \t\r\n]+ // required whitespace
