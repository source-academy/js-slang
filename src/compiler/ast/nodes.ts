import { ChanDir } from "../ssa/types";
import { nodeType } from "./nodeTypes";

// Node types

export interface GoNode {
    Pos() : Pos.Pos; // position of first character of node
    End() : Pos.Pos; // position of first character immediately after node
    getType() : nodeType;
}

export interface ExprNode extends GoNode {
}

export interface StatementNode extends GoNode {
}

export interface DeclarationNode extends GoNode {
}

export interface SpecNode extends DeclarationNode {
}

// Field represents Field declaration list in
// struct type, method list in interface type, or parameter/
// result declaration in a signature
// Field.Names is nil for unnamed parameters
export class Field implements ExprNode {
    Names: Ident[];
    Tag: BasicLit | undefined;
    Type: ExprNode;
    Pos() : Pos.Pos {
        if (this.Names.length > 0) {
            return this.Names[0].NamePos;
        }
        return Pos.NoPos;
    }

    End() : Pos.Pos {
        if (this.Tag != undefined) {
            return this.Tag.Pos();
        }
        return Pos.NoPos;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(names : Ident[], tag : BasicLit | undefined, type : ExprNode) {
        this.Names = names;
        this.Tag = tag;
        this.Type = type;
    }
}

// FieldList represents a list of Fields, enclosed by parantheses or braces
export class FieldList implements ExprNode {
    Opening: Pos.Pos; // position of opening parenthesis/brace, if any
    List: Field[] | undefined // field list/undefined
    Closing: Pos.Pos; // position of closing parenthesis/brace, if any

    Pos() : Pos.Pos {
        if (Pos.isValid(this.Opening)) {
            return this.Opening;
        }
        return Pos.NoPos;
    }

    End() : Pos.Pos {
        if (Pos.isValid(this.Closing)) {
            return this.Closing;
        }
        return Pos.NoPos;
    }

    // Returns number of parameters/struct fields represented by FieldList
    NumFields() : number {
        let count = 0;
        if (this.List !== undefined) {
            for (var field of this.List) {
                let fieldNameCnt = field.Names.length;
                if (fieldNameCnt == 0) {
                    fieldNameCnt = 1;
                }
                count += fieldNameCnt;
            }
        }
        return count;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(opening : Pos.Pos, list: Field[] | undefined, closing : Pos.Pos) {
        this.Opening = opening;
        this.List = list;
        this.Closing = closing;
    }
}

// BadExpr node is a placeholder for expressions containing syntax errors
export class BadExpr implements ExprNode {
    From: Pos.Pos; // start of bad expression
    To: Pos.Pos; // end of bad expression

    Pos() : Pos.Pos {
        return this.From;
    }
    
    End() : Pos.Pos {
        return this.To;
    }

    getType() : nodeType {
        return nodeType.ILLEGAL;
    }

    constructor(start : Pos.Pos, end : Pos.Pos) {
        this.From = start;
        this.To = end;
    }
}

// Ident node represents Identifiers
export class Ident implements ExprNode {
    NamePos: Pos.Pos; // identifier position
    Name: string; // identifier name

    Pos() : Pos.Pos {
        return this.NamePos;
    }

    End() : Pos.Pos {
        return this.NamePos + this.Name.length;
    }

    getType() : nodeType {
        return nodeType.IDENT;
    }

    constructor(pos : Pos.Pos, name : string) {
        this.NamePos = pos;
        this.Name = name;
    }
}

// Ellipsis node represents "..." type in parameter list/length in array type
export class Ellipsis implements ExprNode {
    Ellipsis: Pos.Pos; // position of "..."
    ElementType: ExprNode | undefined; // ellipsis element type (for parameter lists) or undefined

    Pos() : Pos.Pos {
        return this.Ellipsis;
    }

    End() : Pos.Pos {
        if (this.ElementType != undefined) {
            return this.ElementType.End();
        }
        return this.Ellipsis + 3;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(ellipPos : Pos.Pos, eltType : ExprNode | undefined) {
        this.Ellipsis = ellipPos;
        this.ElementType = eltType;
    }
}

// BasicLit node represents literal of basic type
export class BasicLit implements ExprNode {
    ValuePos: Pos.Pos; // position of literal
    Kind: Token.token; // token.INT, token.FLOAT, token.IMAG, token.CHAR, or token.STRING
    Value: string; // literal string

    Pos() : Pos.Pos {
        return this.ValuePos;
    }

    End() : Pos.Pos {
        return this.ValuePos + this.Value.length;
    }

    getType() : nodeType {
        return nodeType.BASIC_LIT;
    }

    getDataType() : Token.token {
        return this.Kind;
    }

    constructor(pos : Pos.Pos, kind : string, val : string) {
        this.ValuePos = pos;
        this.Kind = Token.getToken(kind);
        this.Value = val;
    }
}

// FuncLit node represents function literal
export class FuncLit implements ExprNode {
    Type: FuncType;
    Body: BlockStmt;

    Pos() : Pos.Pos {
        return this.Type.Pos();
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(ftype : FuncType, body : BlockStmt) {
        this.Type = ftype;
        this.Body = body;
    }
}

// CompositeLit node represents composite literal
export class CompositeLit implements ExprNode {
    Type: ExprNode | undefined; // literal type or undefined
    LeftBrace: Pos.Pos; // position of "{"
    Elements: ExprNode[]; // list of composite elements
    RightBrace: Pos.Pos; // position of "}"
    Incomplete: boolean; // true if source expression missing in Elements list

    Pos() : Pos.Pos {
        if (this.Type != undefined) {
            return this.Type.Pos();
        }
        return this.LeftBrace;
    }

    End() : Pos.Pos {
        return this.RightBrace + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(type : ExprNode | undefined, lbrace : Pos.Pos, elmts : ExprNode[], rbrace: Pos.Pos, incomplete : boolean) {
        this.Type = type;
        this.LeftBrace = lbrace;
        this.Elements = elmts;
        this.RightBrace = rbrace;
        this.Incomplete = incomplete;
    }
}

// ParenExpr node represents parenthesised expression
export class ParenExpr implements ExprNode {
    LeftParen: Pos.Pos; // position of "("
    Expr: ExprNode; // parenthesised expression
    RightParen: Pos.Pos; // position of ")"

    Pos() : Pos.Pos {
        return this.LeftParen;
    }

    End() : Pos.Pos {
        return this.RightParen + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(lparen : Pos.Pos, expr : ExprNode, rparen : Pos.Pos) {
        this.LeftParen = lparen;
        this.Expr = expr;
        this.RightParen = rparen;
    }
}

// SelectorExpr node represents expression followed by selector
export class SelectorExpr implements ExprNode {
    Expr: ExprNode; // expression
    Selector: Ident; // field selector

    Pos() : Pos.Pos {
        return this.Expr.Pos();
    }

    End() : Pos.Pos {
        return this.Selector.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(expr : ExprNode, selector : Ident) {
        this.Expr = expr;
        this.Selector = selector;
    }
}

// IndexExpr node represents expression followed by index
export class IndexExpr implements ExprNode {
    Expr: ExprNode; // expression
    LeftBrack: Pos.Pos; // position of "["
    Index: ExprNode; // index expression
    RightBrack: Pos.Pos; // position of "]"

    Pos() : Pos.Pos {
        return this.Expr.Pos();
    }

    End() : Pos.Pos {
        return this.RightBrack + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(expr : ExprNode, lbrack : Pos.Pos, idx : ExprNode, rbrack : Pos.Pos) {
        this.Expr = expr;
        this.LeftBrack = lbrack;
        this.Index = idx;
        this.RightBrack = rbrack;
    }
}

// SliceExpr node represents expression followed by slice indices
export class SliceExpr implements ExprNode {
    Expr: ExprNode; // expression
    LeftBrack: Pos.Pos; // position of "["
    Low: ExprNode | undefined; // beginning of slice range or undefined
    High: ExprNode | undefined; // end of slice range or undefined
    Max: ExprNode | undefined; // maximum capacity of slice or undefined
    ThreeSlice: boolean; // true if 2 colons present (3-index slice)
    RightBrack: Pos.Pos; // position of "]"

    Pos() : Pos.Pos {
        return this.Expr.Pos();
    }

    End() : Pos.Pos {
        return this.RightBrack + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(expr : ExprNode, lbrack : Pos.Pos, low : ExprNode | undefined, high : ExprNode | undefined, max : ExprNode | undefined, isThree : boolean, rbrack : Pos.Pos) {
        this.Expr = expr;
        this.LeftBrack = lbrack;
        this.Low = low;
        this.High = high;
        this.Max = max;
        this.ThreeSlice = isThree;
        this.RightBrack = rbrack;
    }
}

// TypeAssertExpr node represents expression followed by type assertion
export class TypeAssertExpr implements ExprNode {
    Expr: ExprNode; // expression
    LeftParen: Pos.Pos; // position of "("
    Type: ExprNode | undefined; // asserted type; if undefined, means type switch X.(type)
    RightParen: Pos.Pos; // position of ")"

    Pos() : Pos.Pos {
        return this.Expr.Pos();
    }

    End() : Pos.Pos {
        return this.RightParen + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(expr : ExprNode, lparen : Pos.Pos, type : ExprNode | undefined, rparen : Pos.Pos) {
        this.Expr = expr;
        this.LeftParen = lparen;
        this.Type = type;
        this.RightParen = rparen;
    }
}

// CallExpr node represents expression followed by argument list
export class CallExpr implements ExprNode {
    Func: ExprNode; // function expression
    LeftParen: Pos.Pos; // position of "("
    Args: ExprNode[] | undefined; // function arguments
    Ellipsis: Pos.Pos; // position of "..." (Pos.NoPos if none given)
    RightParen: Pos.Pos; // position of ")"

    Pos() : Pos.Pos {
        return this.Func.Pos();
    }

    End() : Pos.Pos {
        return this.RightParen + 1;
    }

    getType() : nodeType {
        return nodeType.CALL;
    }

    constructor(func : ExprNode, lparen : Pos.Pos, args : ExprNode[] | undefined, ellipsis : Pos.Pos, rparen: Pos.Pos) {
        this.Func = func;
        this.LeftParen = lparen;
        this.Args = args;
        this.Ellipsis = ellipsis;
        this.RightParen = rparen;
    }
}

// StarExpr represents expression of "*" Expression
// Either a unary "*" exprression or a pointer type
export class StarExpr implements ExprNode {
    Star: Pos.Pos; // position of "*"
    Expr: ExprNode; // operand

    Pos() : Pos.Pos {
        return this.Star;
    }

    End() : Pos.Pos {
        return this.Expr.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(star : Pos.Pos, expr : ExprNode) {
        this.Star = star;
        this.Expr = expr;
    }
}

// UnaryExpr node represents unary expression
// Unary "*" expressions represented via StarExpr
export class UnaryExpr implements ExprNode {
    OpPos: Pos.Pos; // position of Operator
    Op: Token.token; // operator
    X: ExprNode; //operand

    Pos() : Pos.Pos {
        return this.OpPos;
    }

    End() : Pos.Pos {
        return this.X.End();
    }

    getType() : nodeType {
        return nodeType.UNARY;
    }

    constructor(pos : Pos.Pos, op : string, expr : ExprNode) {
        this.OpPos = pos;
        this.Op = Token.getToken(op);
        this.X = expr;
    }
}

// BinaryExpr node represents binary expression
export class BinaryExpr implements ExprNode {
    X: ExprNode; // left operand
    OpPos: Pos.Pos; // position of operand
    Op: Token.token; // operator
    Y: ExprNode; // right operand

    Pos() : Pos.Pos {
        return this.X.Pos();
    }

    End() : Pos.Pos {
        return this.Y.End();
    }

    getType() : nodeType {
        return nodeType.BINARY;
    }

    constructor(x : ExprNode, pos : Pos.Pos, op : string, y : ExprNode) {
        this.X = x;
        this.OpPos = pos;
        this.Op = Token.getToken(op);
        this.Y = y;
    }
}

// KeyValueExpr node represents (key : value) pairs
export class KeyValueExpr implements ExprNode {
    Key: ExprNode; // key
    Colon: Pos.Pos; // position of ":"
    Value: ExprNode; // value

    Pos() : Pos.Pos {
        return this.Key.Pos();
    }

    End() : Pos.Pos {
        return this.Value.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(key : ExprNode, colon : Pos.Pos, val : ExprNode) {
        this.Key = key;
        this.Colon = colon;
        this.Value = val;
    }
}

// Type represented by tree consisting of one or more type-specific expression nodes

// ArrayType node represents array or slice type
export class ArrayType implements ExprNode {
    LeftBrack: Pos.Pos; // position of "["
    Length: ExprNode | undefined; // ellipsis node for [...]T array types, undefined for slices
    ElementType: ExprNode; // element type

    Pos() : Pos.Pos {
        return this.LeftBrack;
    }

    End() : Pos.Pos {
        return this.ElementType.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(lbrack : Pos.Pos, len : ExprNode | undefined, elmType : ExprNode) {
        this.LeftBrack = lbrack;
        this.Length = len;
        this.ElementType = elmType;
    }
}

// StructType node repesents struct type
export class StructType implements ExprNode {
    Struct: Pos.Pos; // position of "struct" keyword
    Fields: FieldList; // list of field declarations
    Incomplete: boolean; // true if source fields are missing in Fields

    Pos() : Pos.Pos {
        return this.Struct;
    }

    End() : Pos.Pos {
        return this.Fields.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, fields : FieldList, incomplete : boolean) {
        this.Struct = pos;
        this.Fields = fields;
        this.Incomplete = incomplete;
    }
}

// FuncType node represents function type
export class FuncType implements ExprNode {
    Func: Pos.Pos; // position of "func" keyword (Pos.NoPos if no keyword)
    Params: FieldList; // parameters
    Results: FieldList | undefined; // results or undefined

    Pos() : Pos.Pos {
        if (Pos.isValid(this.Func)) {
            return this.Func;
        }
        return this.Params.Pos();
    }

    End() : Pos.Pos {
        if (this.Results != null) {
            return this.Results.End();
        }
        return this.Params.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(funcPos : Pos.Pos, params : FieldList, results : FieldList | undefined) {
        this.Func = funcPos;
        this.Params = params;
        this.Results = results;
    }
}

// InterfaceType node represents interface type
export class InterfaceType implements ExprNode {
    Interface: Pos.Pos; // position of "interface" keyword
    Methods: FieldList; // list of methods
    Incomplete: boolean; // true if source methods missing in Methods list

    Pos() : Pos.Pos {
        return this.Interface;
    }

    End() : Pos.Pos {
        return this.Methods.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, methods : FieldList, incomplete : boolean) {
        this.Interface = pos;
        this.Methods = methods;
        this.Incomplete = incomplete;
    }
}

// MapType node represents map type
export class MapType implements ExprNode {
    Map: Pos.Pos; // position of "map" keyword
    Key: ExprNode; // key type
    Value: ExprNode; // value type

    Pos() : Pos.Pos {
        return this.Map;
    }

    End() : Pos.Pos {
        return this.Value.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, key: ExprNode, val : ExprNode) {
        this.Map = pos;
        this.Key = key;
        this.Value = val;
    }
}

// ChanType node represents channel type
export class ChanType implements ExprNode {
    Begin: Pos.Pos; // position of "chan" keyword or "<-", whichever comes first
    Arrow: Pos.Pos; // position of "<-" (Pos.NoPos if not found)
    Direction: ChanDir; // channel direction
    Value: ExprNode; // value type

    Pos() : Pos.Pos {
        return this.Begin;
    }

    End() : Pos.Pos {
        return this.Value.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(begin : Pos.Pos, arrowPos : Pos.Pos, dir : ChanDir, val : ExprNode) {
        this.Begin = begin;
        this.Arrow = arrowPos;
        this.Direction = dir;
        this.Value = val;
    }
}

// Statements are represented by a tree consisting of one or more concrete statement nodes

// BadStmt node is a placeholder for statements consisting syntax errors
export class BadStmt implements StatementNode {
    From: Pos.Pos; // start of bad statement
    To: Pos.Pos; // end of bad statement

    Pos() : Pos.Pos {
        return this.From;
    }

    End() : Pos.Pos {
        return this.To;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(start : Pos.Pos, end : Pos.Pos) {
        this.From = start;
        this.To = end;
    }
}

// DeclStmt node represents declaration in statement list
export class DeclStmt implements StatementNode {
    Decl: DeclarationNode; // GenDecl with CONST, TYPE, or VAR token

    Pos() : Pos.Pos {
        return this.Decl.Pos();
    }

    End() : Pos.Pos {
        return this.Decl.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(decl : DeclarationNode) {
        this.Decl = decl;
    }
}

// EmptyStmt node represents empty statement
// position is the position of the semicolon (implicit/explicit) that immediately follows after
export class EmptyStmt implements StatementNode {
    Semicolon: Pos.Pos; // position of following ";"
    Implicit: boolean; // true if ";" omitted in source

    Pos() : Pos.Pos {
        return this.Semicolon;
    }

    End() : Pos.Pos {
        if (this.Implicit) {
            return this.Semicolon;
        }
        return this.Semicolon + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, implicit : boolean) {
        this.Semicolon = pos;
        this.Implicit = implicit;
    }
}

// LabeledStmt node represents labeled statement (e.g. goto End)
export class LabeledStmt implements StatementNode {
    Label: Ident; // label
    Colon: Pos.Pos; // position of ":"
    Stmt: StatementNode; // statement

    Pos() : Pos.Pos {
        return this.Label.Pos();
    }

    End() : Pos.Pos {
        return this.Stmt.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(label : Ident, colon : Pos.Pos, stmt : StatementNode) {
        this.Label = label;
        this.Colon = colon;
        this.Stmt = stmt;
    }
}

// ExprStmt node represents stand-alone expression in statement list
export class ExprStmt implements StatementNode {
    Expr: ExprNode; // expression

    Pos() : Pos.Pos {
        return this.Expr.Pos();
    }

    End() : Pos.Pos {
        return this.Expr.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(expr : ExprNode) {
        this.Expr = expr;
    }
}

// SendStmt node represents send statement
export class SendStmt implements StatementNode {
    Chan: ExprNode; // channel
    Arrow: Pos.Pos; // position of "<-"
    Value: ExprNode; // expression to send

    Pos() : Pos.Pos {
        return this.Chan.Pos();
    }

    End() : Pos.Pos {
        return this.Value.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(ch : ExprNode, arrow : Pos.Pos, val : ExprNode) {
        this.Chan = ch;
        this.Arrow = arrow;
        this.Value = val;
    }
}

// IncDecStmt node represents increment or decrement statement
export class IncDecStmt implements StatementNode {
    Expr: ExprNode; // value
    TokPos: Pos.Pos; // position of token
    Tok: Token.token; // INC or DEC

    Pos() : Pos.Pos {
        return this.Expr.Pos();
    }

    End() : Pos.Pos {
        return this.TokPos + 2; // "++" or "--"
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(expr : ExprNode, pos : Pos.Pos, token : string) {
        this.Expr = expr;
        this.TokPos = pos;
        this.Tok = Token.getToken(token);
    }
}

// AssignStmt node represents assignment/short variable declaration
export class AssignStmt implements StatementNode {
    LeftHandSide: ExprNode[]; // left hand expressions (multiple assignments)
    TokPos: Pos.Pos; // position of token
    Tok: Token.token; // assignment token / DEFINE
    RightHandSide: ExprNode[]; // expressions on right hand side

    Pos() : Pos.Pos {
        // TO TEST: at least one element guaranteed to exist in LeftHandSide
        return this.LeftHandSide[0].Pos();
    }

    End() : Pos.Pos {
        // TO TEST: at least one element guaranteed to exist in RightHandSide
        return this.RightHandSide[this.RightHandSide.length - 1].End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(lhs : ExprNode[], pos : Pos.Pos, token : string, rhs : ExprNode[]) {
        this.LeftHandSide = lhs;
        this.TokPos = pos;
        this.Tok = Token.getToken(token);
        this.RightHandSide = rhs;
    }
}

// GoStmt node represents go statement
export class GoStmt implements StatementNode {
    Go: Pos.Pos; // position of "go" keyword
    Call: CallExpr; // goroutine to start

    Pos() : Pos.Pos {
        return this.Go;
    }

    End() : Pos.Pos {
        return this.Call.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, callExp : CallExpr) {
        this.Go = pos;
        this.Call = callExp;
    }
}

// DeferStmt node represents defer statement
export class DeferStmt implements StatementNode {
    Defer: Pos.Pos; // position of "defer" keyword
    Call: CallExpr; // expression to defer

    Pos() : Pos.Pos {
        return this.Defer;
    }

    End() : Pos.Pos {
        return this.Call.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, callExp : CallExpr) {
        this.Defer = pos;
        this.Call = callExp;
    }
}

// ReturnStmt node represents return statement
export class ReturnStmt implements StatementNode {
    Return: Pos.Pos; // position of "return" keyword
    Results: ExprNode[]; // result expressions or null

    Pos() : Pos.Pos {
        return this.Return;
    }

    End() : Pos.Pos {
        if (this.Results != null && this.Results.length > 0) {
            return this.Results[this.Results.length - 1].End();
        }
        return this.Return + 6; // "return"
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, results : ExprNode[]) {
        this.Return = pos;
        this.Results = results;
    }
}

// BranchStmt node represents break/continue/goto/fallthrough
export class BranchStmt implements StatementNode {
    TokPos: Pos.Pos; // position of token
    Tok: Token.token; // keyword token (BREAK, CONTINUE, GOTO, FALLTHROUGH)
    Label: Ident | undefined; // label name or undefined

    Pos() : Pos.Pos {
        return this.TokPos;
    }

    End() : Pos.Pos {
        if (this.Label != null) {
            return this.Label.End();
        }
        return this.TokPos + Token.token[this.Tok].length;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, token : string, label : Ident | undefined) {
        this.TokPos = pos;
        this.Tok = Token.getToken(token);
        this.Label = label;
    }
}

// BlockStmt node represents braced statement list
export class BlockStmt implements StatementNode {
    LeftBrace: Pos.Pos; // position of "{"
    List: StatementNode[]; // list of statements
    RightBrace: Pos.Pos; // position of "}"

    Pos() : Pos.Pos {
        return this.LeftBrace;
    }

    End() : Pos.Pos {
        return this.RightBrace + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(lbrace : Pos.Pos, lst : StatementNode[], rbrace: Pos.Pos) {
        this.LeftBrace = lbrace;
        this.List = lst;
        this.RightBrace = rbrace;
    }
}

// IfStmt node represents if statement
export class IfStmt implements StatementNode {
    If: Pos.Pos; // position of "if" keyword
    Init: StatementNode | undefined; // initialisation statement or undefined
    Cond: ExprNode; // condition
    Body: BlockStmt; // consequent
    Else: StatementNode | undefined; // alternative

    Pos() : Pos.Pos {
        return this.If;
    }

    End() : Pos.Pos {
        if (this.Else != null) {
            return this.Else.End();
        }
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.IF;
    }

    constructor(pos : Pos.Pos, init : StatementNode | undefined, cond : ExprNode, body : BlockStmt, elseStm : StatementNode | undefined) {
        this.If = pos;
        this.Init = init;
        this.Cond = cond;
        this.Body = body;
        this.Else = elseStm;
    }
}

// CaseClause node represents case of expression/type switch statement
export class CaseClause implements StatementNode {
    Case: Pos.Pos; // position of "case"/"default" keyword
    List: ExprNode[]; // list of expressions/types
    Colon: Pos.Pos; // position of ":"
    Body: StatementNode[] // body

    Pos() : Pos.Pos {
        return this.Case;
    }

    End() : Pos.Pos {
        if (this.Body != null && this.Body.length > 0) {
            return this.Body[this.Body.length - 1].End();
        }
        return this.Colon + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(cse : Pos.Pos, lst : ExprNode[], colon : Pos.Pos, body : StatementNode[]) {
        this.Case = cse;
        this.List = lst;
        this.Colon = colon;
        this.Body = body;
    }
}

// SwitchStmt node represents expression switch statement
export class SwitchStmt implements StatementNode {
    Switch: Pos.Pos; // position of "switch" keyword
    Init: StatementNode | undefined; // initialisation statement / undefined
    Tag: ExprNode | undefined; // tag expression / undefined
    Body: BlockStmt; // block of CaseClauses only

    Pos() : Pos.Pos {
        return this.Switch;
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, init : StatementNode | undefined, tag : ExprNode | undefined, body : BlockStmt) {
        this.Switch = pos;
        this.Init = init;
        this.Tag = tag;
        this.Body = body;
    }
}

// TypeSwitchStmt node represents type switch statement
export class TypeSwitchStmt implements StatementNode {
    Switch: Pos.Pos; // position of "switch" keyword
    Init: StatementNode | undefined; // initialisation statement/undefined
    Assign: StatementNode; // assignment statement or selector statement
    Body: BlockStmt; // block of CaseClauses only

    Pos() : Pos.Pos {
        return this.Switch;
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, init : StatementNode | undefined, assign : StatementNode, body : BlockStmt) {
        this.Switch = pos;
        this.Init = init;
        this.Assign = assign;
        this.Body = body;
    }
}

// CommClause node represents case of select statement
export class CommClause implements StatementNode {
    Case: Pos.Pos; // position of "case"/"default" keyword
    Comm: StatementNode | undefined; // send or receive statement, undefined for default case
    Colon: Pos.Pos; // position of ":"
    Body: StatementNode[]; // statement list

    Pos() : Pos.Pos {
        return this.Case;
    }

    End() : Pos.Pos {
        if (this.Body != null && this.Body.length > 0) {
            return this.Body[this.Body.length - 1].End();
        }
        return this.Colon + 1;
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(cse : Pos.Pos, comm : StatementNode | undefined, colon : Pos.Pos, body : StatementNode[]) {
        this.Case = cse;
        this.Comm = comm;
        this.Colon = colon;
        this.Body = body;
    }
}

// SelectStmt node represents select statement
export class SelectStmt implements StatementNode {
    Select: Pos.Pos; // position of "select" keyword
    Body: BlockStmt; // CommClauses only

    Pos() : Pos.Pos {
        return this.Select;
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(pos : Pos.Pos, body : BlockStmt) {
        this.Select = pos;
        this.Body = body;
    }
}

// ForStmt node represents for statement
export class ForStmt implements StatementNode {
    For: Pos.Pos; // position of "for" keyword
    Init:  StatementNode | undefined; // initialisation statement/undefined
    Cond: ExprNode | undefined; // condition/undefined
    Post: StatementNode | undefined; // post iteration statement/undefined
    Body: BlockStmt; // body

    Pos() : Pos.Pos {
        return this.For;
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.FOR;
    }

    constructor(pos : Pos.Pos, init : StatementNode | undefined, cond : ExprNode | undefined, post : StatementNode | undefined, body : BlockStmt) {
        this.For = pos;
        this.Init = init;
        this.Cond = cond;
        this.Post = post;
        this.Body = body;
    }
}

// RangeStmt represents for statement with range clause
export class RangeStmt implements StatementNode {
    For: Pos.Pos; // position of "for" keyword
    Key: ExprNode | undefined; // key expression/undefined
    Value: ExprNode | undefined; // value expression/undefined
    TokPos: Pos.Pos; // position of token, invalid if Key is null
    Tok: Token.token; // ILLEGAL if Key is null, ASSIGN, DEFINE
    Expr: ExprNode; // value to range over
    Body: BlockStmt; // body

    Pos() : Pos.Pos {
        return this.For;
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(forPos : Pos.Pos, key : ExprNode | undefined, val : ExprNode | undefined, tokPos : Pos.Pos, token : string, expr : ExprNode, body : BlockStmt) {
        this.For = forPos;
        this.Key = key;
        this.Value = val;
        this.TokPos = tokPos;
        this.Tok = Token.getToken(token);
        this.Expr = expr;
        this.Body = body;
    }
}

// Declarations

// Spec node represents single (non-parenthesised) constant, type, or variable declaration

// ValueSpec node represents constant or variable declaration (ConstSpec / VarSpec production)
export class ValueSpec implements SpecNode {
    Names: Ident[]; // value names (guaranteed to be non-empty)
    Type: ExprNode | undefined; // value type / undefined
    Values: ExprNode[]; // initial values

    Pos() : Pos.Pos {
        return this.Names[0].Pos();
    }

    End() : Pos.Pos {
        if (this.Values != null && this.Values.length > 0) {
            return this.Values[this.Values.length - 1].End();
        }
        if (this.Type != null) {
            return this.Type.End();
        }
        return this.Names[this.Names.length - 1].End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(names : Ident[], type : ExprNode | undefined, values : ExprNode[]) {
        this.Names = names;
        this.Type = type;
        this.Values = values;
    }
}

// TypeSpec node represents type declaration (TypeSpec production)
export class TypeSpec implements SpecNode {
    Name: Ident; // type name
    Assign: Pos.Pos; // position of '=', if any
    Type: ExprNode; // Ident, ParentExpr, SelectorExpr, StarExpr, or any of the XxxTypes

    Pos() : Pos.Pos {
        return this.Name.Pos();
    }

    End() : Pos.Pos {
        return this.Type.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(name : Ident, assign : Pos.Pos, type : ExprNode) {
        this.Name = name;
        this.Assign = assign;
        this.Type = type;
    }
}

// Declarations are represented by one of the following declaration nodes

// BadDecl node is a placeholder for declarations containing syntax errors
export class BadDecl implements DeclarationNode {
    From: Pos.Pos; // start of bad declaration
    To: Pos.Pos; // end of bad declaration

    Pos() : Pos.Pos {
        return this.From;
    }

    End() : Pos.Pos {
        return this.To;
    }

    getType() : nodeType {
        return nodeType.ILLEGAL;
    }

    constructor(start : number, end : number) {
        this.From = start;
        this.To = end;
    }
}

// GenDecl node (general declaration) represents a constant, type, or variable declaration
// If LeftParen position is valid, the declaration is parenthesised
export class GenDecl implements DeclarationNode {
    TokPos: Pos.Pos; // position of Tok
    Tok: Token.token; // CONST/TYPE/VAR
    LeftParen: Pos.Pos; // position of "(" if any
    Specs: SpecNode[]; // constant/variable declarations
    RightParen: Pos.Pos; // position of ")" if any 

    Pos() : Pos.Pos {
        return this.TokPos;
    }

    End() : Pos.Pos {
        if (Pos.isValid(this.RightParen)) {
            return this.RightParen + 1;
        }
        // only one spec
        return this.Specs[0].End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(start : Pos.Pos, token : string, leftPos : Pos.Pos, specs : SpecNode[], rightPos : Pos.Pos) {
        this.TokPos = start;
        this.Tok = Token.getToken(token);
        this.LeftParen = leftPos;
        this.Specs = specs;
        this.RightParen = rightPos;
    }
}

// FuncDecl node represents a function declaration
export class FuncDecl implements DeclarationNode {
    Recv: FieldList | undefined; // Receiver methods or undefined (functions)
    Name: Ident; // function/method name
    Type: FuncType; // function signature: parameters, results, position of "func" keyword
    Body: BlockStmt; // function body

    Pos() : Pos.Pos {
        return this.Type.Pos();
    }

    End() : Pos.Pos {
        return this.Body.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(recv : FieldList | undefined, name : Ident, funcType : FuncType, body : BlockStmt) {
        this.Recv = recv;
        this.Name = name;
        this.Type = funcType;
        this.Body = body;
    }
}

// File node represents a Go source node
// This exists merely to read the root node returned by the parser
export class File implements GoNode {
    Decls: DeclarationNode[]; // top-level declarations/nil
    Package: Pos.Pos; // position of "package" keyword
    Name: Ident; // package name
    Unresolved: Ident[]; // unresolved identifiers

    Pos() : Pos.Pos {
        return this.Package;
    }

    End() : Pos.Pos {
        if (this.Decls.length > 0) {
            return this.Decls[this.Decls.length - 1].End();
        }
        return this.Name.End();
    }

    getType() : nodeType {
        return nodeType.NOT_IMPLEMENTED;
    }

    constructor(decls : DeclarationNode[], pkgPos : Pos.Pos, name : Ident) {
        this.Decls = decls;
        this.Package = pkgPos;
        this.Name = name;
        this.Unresolved = [];
    }
}