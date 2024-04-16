export type Token = number;

export enum token {
    // Special tokens
    ILLEGAL,
    EOF,
    COMMENT,

    literal_beg,
    // Identifiers and basic type literals
    // (these tokens stand for classes of literals)
    IDENT,  // main
    INT,    // 12345
    FLOAT,  // 123.45
    IMAG,   // 123.45i
    CHAR,   // 'a'
    STRING, // "abc"
    literal_end,

    operator_beg,
    // Operators and delimiters
    ADD, // +
    SUB, // -
    MUL, // *
    QUO, // /
    REM, // %

    AND,     // &
    OR,      // |
    XOR,     // ^
    SHL,     // <<
    SHR,     // >>
    AND_NOT, // &^

    ADD_ASSIGN, // +=
    SUB_ASSIGN, // -=
    MUL_ASSIGN, // *=
    QUO_ASSIGN, // /=
    REM_ASSIGN, // %=

    AND_ASSIGN,     // &=
    OR_ASSIGN,      // |=
    XOR_ASSIGN,     // ^=
    SHL_ASSIGN,     // <<=
    SHR_ASSIGN,     // >>=
    AND_NOT_ASSIGN, // &^=

    LAND,  // &&
    LOR,   // ||
    ARROW, // <-
    INC,   // ++
    DEC,   // --

    EQL,    // ==
    LSS,    // <
    GTR,    // >
    ASSIGN, // =
    NOT,    // !

    NEQ,      // !=
    LEQ,      // <=
    GEQ,      // >=
    DEFINE,   // :=
    ELLIPSIS, // ...

    LPAREN, // (
    LBRACK, // [
    LBRACE, // {
    COMMA,  // ,
    PERIOD, // .

    RPAREN,    // )
    RBRACK,    // ]
    RBRACE,    // }
    SEMICOLON, // ;
    COLON,     // :
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
    additional_end,
}

const tokenMap : Map<string, token> = new Map([
    ["ILLEGAL", token.ILLEGAL],
    ["EOF", token.EOF],
    ["COMMENT", token.COMMENT],

    ["IDENT", token.IDENT],
    ["INT", token.INT],
    ["FLOAT", token.FLOAT],
    ["IMAG", token.IMAG],
    ["CHAR", token.CHAR],
    ["STRING", token.STRING],

    ["ADD", token.ADD],
    ["SUB", token.SUB],
    ["MUL", token.MUL],
    ["QUO", token.QUO],
    ["REM", token.REM],

    ["AND", token.AND],
    ["OR", token.OR],
    ["XOR", token.XOR],
    ["SHL", token.SHL],
    ["SHR", token.SHR],
    ["AND_NOT", token.AND_NOT],

    ["ADD_ASSIGN", token.ADD_ASSIGN],
    ["SUB_ASSIGN", token.SUB_ASSIGN],
    ["MUL_ASSIGN", token.MUL_ASSIGN],
    ["QUO_ASSIGN", token.QUO_ASSIGN],
    ["REM_ASSIGN", token.REM_ASSIGN],

    ["AND_ASSIGN", token.AND_ASSIGN],
    ["OR_ASSIGN", token.OR_ASSIGN],
    ["XOR_ASSIGN", token.XOR_ASSIGN],
    ["SHL_ASSIGN", token.SHL_ASSIGN],
    ["SHR_ASSIGN", token.SHR_ASSIGN],
    ["AND_NOT_ASSIGN", token.AND_NOT_ASSIGN],

    ["LAND", token.LAND],
    ["LOR", token.LOR],
    ["ARROW", token.ARROW],
    ["INC", token.INC],
    ["DEC", token.DEC],

    ["EQL", token.EQL],
    ["LSS", token.LSS],
    ["GTR", token.GTR],
    ["ASSIGN", token.ASSIGN],
    ["NOT", token.NOT],

    ["NEQ", token.NEQ],
    ["LEQ", token.LEQ],
    ["GEQ", token.GEQ],
    ["DEFINE", token.DEFINE],
    ["ELLIPSIS", token.ELLIPSIS],

    ["LPAREN", token.LPAREN],
    ["LBRACK", token.LBRACK],
    ["LBRACE", token.LBRACE],
    ["COMMA", token.COMMA],
    ["PERIOD", token.PERIOD],

    ["RPAREN", token.RPAREN],
    ["RBRACK", token.RBRACK],
    ["RBRACE", token.RBRACE],
    ["SEMICOLON", token.SEMICOLON],
    ["COLON", token.COLON],

    ["BREAK", token.BREAK],
    ["CASE", token.CASE],
    ["CHAN", token.CHAN],
    ["CONST", token.CONST],
    ["CONTINUE", token.CONTINUE],

    ["DEFAULT", token.DEFAULT],
    ["DEFER", token.DEFAULT],
    ["ELSE", token.ELSE],
    ["FALLTHROUGH", token.FALLTHROUGH],
    ["FOR", token.FOR],
    
    ["FUNC", token.FUNC],
    ["GO", token.GO],
    ["GOTO", token.GOTO],
    ["IF", token.IF],
    ["IMPORT", token.IMPORT],

    ["INTERFACE", token.INTERFACE],
    ["MAP", token.MAP],
    ["PACKAGE", token.PACKAGE],
    ["RANGE", token.RANGE],
    ["RETURN", token.RETURN],

    ["SELECT", token.SELECT],
    ["STRUCT", token.STRUCT],
    ["SWITCH", token.SWITCH],
    ["TYPE", token.TYPE],
    ["VAR", token.VAR],

    ["TILDE", token.TILDE],
    ["UNDEFINED", token.UNDEFINED],
]);

export function getToken(str : string) : token {
    const upper = str.toUpperCase();
    const tok = tokenMap.get(upper);
    if (tok !== undefined) {
        return tok;
    }
    return token.ILLEGAL;
}