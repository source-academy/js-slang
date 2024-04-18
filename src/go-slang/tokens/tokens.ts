export type Token = number

export enum token {
  // Special tokens
  ILLEGAL,
  EOF,
  COMMENT,

  literal_beg,
  // Identifiers and basic type literals
  // (these tokens stand for classes of literals)
  IDENT, // main
  INT, // 12345
  FLOAT, // 123.45
  IMAG, // 123.45i
  CHAR, // 'a'
  STRING, // "abc"
  literal_end,

  operator_beg,
  // Operators and delimiters
  ADD, // +
  SUB, // -
  MUL, // *
  QUO, // /
  REM, // %

  AND, // &
  OR, // |
  XOR, // ^
  SHL, // <<
  SHR, // >>
  AND_NOT, // &^

  ADD_ASSIGN, // +=
  SUB_ASSIGN, // -=
  MUL_ASSIGN, // *=
  QUO_ASSIGN, // /=
  REM_ASSIGN, // %=

  AND_ASSIGN, // &=
  OR_ASSIGN, // |=
  XOR_ASSIGN, // ^=
  SHL_ASSIGN, // <<=
  SHR_ASSIGN, // >>=
  AND_NOT_ASSIGN, // &^=

  LAND, // &&
  LOR, // ||
  ARROW, // <-
  INC, // ++
  DEC, // --

  EQL, // ==
  LSS, // <
  GTR, // >
  ASSIGN, // =
  NOT, // !

  NEQ, // !=
  LEQ, // <=
  GEQ, // >=
  DEFINE, // :=
  ELLIPSIS, // ...

  LPAREN, // (
  LBRACK, // [
  LBRACE, // {
  COMMA, // ,
  PERIOD, // .

  RPAREN, // )
  RBRACK, // ]
  RBRACE, // }
  SEMICOLON, // ;
  COLON, // :
  operator_end,

  keyword_beg,
  // Keywords
  BREAK,
  CASE,
  CHAN,
  CONST,
  CONTINUE,

  DEFAULT,
  DEFER,
  ELSE,
  FALLTHROUGH,
  FOR,

  FUNC,
  GO,
  GOTO,
  IF,
  IMPORT,

  INTERFACE,
  MAP,
  PACKAGE,
  RANGE,
  RETURN,

  SELECT,
  STRUCT,
  SWITCH,
  TYPE,
  VAR,
  keyword_end,

  additional_beg,
  // additional tokens, handled in an ad-hoc manner
  TILDE,
  UNDEFINED,
  additional_end
}

const tokenMap: Map<string, token> = new Map([
  ['ILLEGAL', token.ILLEGAL],
  ['EOF', token.EOF],
  ['COMMENT', token.COMMENT],

  ['IDENT', token.IDENT],
  ['INT', token.INT],
  ['FLOAT', token.FLOAT],
  ['IMAG', token.IMAG],
  ['CHAR', token.CHAR],
  ['STRING', token.STRING],

  ['+', token.ADD],
  ['-', token.SUB],
  ['*', token.MUL],
  ['/', token.QUO],
  ['%', token.REM],

  ['&', token.AND],
  ['|', token.OR],
  ['^', token.XOR],
  ['<<', token.SHL],
  ['>>', token.SHR],
  ['&^', token.AND_NOT],

  ['+=', token.ADD_ASSIGN],
  ['-=', token.SUB_ASSIGN],
  ['*=', token.MUL_ASSIGN],
  ['/=', token.QUO_ASSIGN],
  ['%=', token.REM_ASSIGN],

  ['&=', token.AND_ASSIGN],
  ['|=', token.OR_ASSIGN],
  ['^=', token.XOR_ASSIGN],
  ['<<=', token.SHL_ASSIGN],
  ['>>-', token.SHR_ASSIGN],
  ['&^=', token.AND_NOT_ASSIGN],

  ['&&', token.LAND],
  ['||', token.LOR],
  ['<-', token.ARROW],
  ['++', token.INC],
  ['--', token.DEC],

  ['==', token.EQL],
  ['<', token.LSS],
  ['>', token.GTR],
  ['=', token.ASSIGN],
  ['!', token.NOT],

  ['!=', token.NEQ],
  ['<=', token.LEQ],
  ['>=', token.GEQ],
  [':=', token.DEFINE],
  ['...', token.ELLIPSIS],

  ['(', token.LPAREN],
  ['[', token.LBRACK],
  ['{', token.LBRACE],
  [',', token.COMMA],
  ['.', token.PERIOD],

  [')', token.RPAREN],
  [']', token.RBRACK],
  ['}', token.RBRACE],
  [';', token.SEMICOLON],
  [':', token.COLON],

  ['BREAK', token.BREAK],
  ['CASE', token.CASE],
  ['CHAN', token.CHAN],
  ['CONST', token.CONST],
  ['CONTINUE', token.CONTINUE],

  ['DEFAULT', token.DEFAULT],
  ['DEFER', token.DEFAULT],
  ['ELSE', token.ELSE],
  ['FALLTHROUGH', token.FALLTHROUGH],
  ['FOR', token.FOR],

  ['FUNC', token.FUNC],
  ['GO', token.GO],
  ['GOTO', token.GOTO],
  ['IF', token.IF],
  ['IMPORT', token.IMPORT],

  ['INTERFACE', token.INTERFACE],
  ['MAP', token.MAP],
  ['PACKAGE', token.PACKAGE],
  ['RANGE', token.RANGE],
  ['RETURN', token.RETURN],

  ['SELECT', token.SELECT],
  ['STRUCT', token.STRUCT],
  ['SWITCH', token.SWITCH],
  ['TYPE', token.TYPE],
  ['VAR', token.VAR],

  ['TILDE', token.TILDE],
  ['UNDEFINED', token.UNDEFINED]
])

export function getToken(str: string): token {
  const upper = str.toUpperCase()
  const tok = tokenMap.get(upper)
  if (tok !== undefined) {
    return tok
  }
  return token.ILLEGAL
}
