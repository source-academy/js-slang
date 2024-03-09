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
    = AdditiveExpression

PrimaryExpression 
    = Literal

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

/* Separators */

_  = [ \t\r\n]* // optional whitespace
__ = [ \t\r\n]+ // required whitespace
