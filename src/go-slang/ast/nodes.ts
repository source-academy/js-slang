import { ChanDir } from '../types/types'
import * as TokType from '../tokens/tokens'
import { nodeType } from './nodeTypes'
// Node types

export interface GoNode {
  getType(): nodeType
}

export interface ExprNode extends GoNode {
  valuesProduced(): number // used to determine number of pop operations required for ExprStmt
}

export interface StatementNode extends GoNode {}

export interface DeclarationNode extends GoNode {}

export interface SpecNode extends DeclarationNode {}

// Field represents Field declaration list in
// struct type, method list in interface type, or parameter/
// result declaration in a signature
// Field.Names is nil for unnamed parameters
export class Field implements ExprNode {
  Names: Ident[]
  Tag: BasicLit | undefined
  Type: ExprNode

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(names: Ident[], tag: BasicLit | undefined, type: ExprNode) {
    this.Names = names
    this.Tag = tag
    this.Type = type
  }
}

// FieldList represents a list of Fields, enclosed by parantheses or braces
export class FieldList implements ExprNode {
  List: Field[] | undefined // field list/undefined

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  // Returns number of parameters/struct fields represented by FieldList
  NumFields(): number {
    let count = 0
    if (this.List !== undefined) {
      for (var field of this.List) {
        let fieldNameCnt = field.Names.length
        if (fieldNameCnt == 0) {
          fieldNameCnt = 1
        }
        count += fieldNameCnt
      }
    }
    return count
  }

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(list: Field[] | undefined) {
    this.List = list
  }
}

// BadExpr node is a placeholder for expressions containing syntax errors
export class BadExpr implements ExprNode {
  getType(): nodeType {
    return nodeType.ILLEGAL
  }

  valuesProduced(): number {
    return 0
  }
}

// Ident node represents Identifiers
export class Ident implements ExprNode {
  Name: string // identifier name

  getType(): nodeType {
    return nodeType.IDENT
  }

  valuesProduced(): number {
    return 1
  }

  constructor(name: string) {
    this.Name = name
  }
}

// Ellipsis node represents "..." type in parameter list/length in array type
export class Ellipsis implements ExprNode {
  ElementType: ExprNode | undefined // ellipsis element type (for parameter lists) or undefined

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(eltType: ExprNode | undefined) {
    this.ElementType = eltType
  }
}

// BasicLit node represents literal of basic type
export class BasicLit implements ExprNode {
  Kind: TokType.token // token.INT, token.FLOAT, token.IMAG, token.CHAR, or token.STRING
  Value: string // literal string

  getType(): nodeType {
    return nodeType.BASIC_LIT
  }

  getDataType(): TokType.token {
    return this.Kind
  }

  valuesProduced(): number {
    return 1
  }

  constructor(kind: string, val: string) {
    this.Kind = TokType.getToken(kind)
    this.Value = val
  }
}

// FuncLit node represents function literal
export class FuncLit implements ExprNode {
  Type: FuncType
  Body: BlockStmt

  getType(): nodeType {
    return nodeType.FUNCLIT
  }

  valuesProduced(): number {
    return this.Type.numResults()
  }

  constructor(ftype: FuncType, body: BlockStmt) {
    this.Type = ftype
    this.Body = body
  }
}

// CompositeLit node represents composite literal
export class CompositeLit implements ExprNode {
  Type: ExprNode | undefined // literal type or undefined
  Elements: ExprNode[] // list of composite elements
  Incomplete: boolean // true if source expression missing in Elements list

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(type: ExprNode | undefined, elmts: ExprNode[], incomplete: boolean) {
    this.Type = type
    this.Elements = elmts
    this.Incomplete = incomplete
  }
}

// ParenExpr node represents parenthesised expression
export class ParenExpr implements ExprNode {
  Expr: ExprNode // parenthesised expression

  getType(): nodeType {
    return nodeType.PAREN
  }

  valuesProduced(): number {
    return this.Expr.valuesProduced()
  }

  constructor(expr: ExprNode) {
    this.Expr = expr
  }
}

// SelectorExpr node represents expression followed by selector
export class SelectorExpr implements ExprNode {
  Expr: ExprNode // expression
  Selector: Ident // field selector

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO VERIFY
    return 1
  }

  constructor(expr: ExprNode, selector: Ident) {
    this.Expr = expr
    this.Selector = selector
  }
}

// IndexExpr node represents expression followed by index
export class IndexExpr implements ExprNode {
  Expr: ExprNode // expression
  Index: ExprNode // index expression

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    return 1
  }

  constructor(expr: ExprNode, idx: ExprNode) {
    this.Expr = expr
    this.Index = idx
  }
}

// SliceExpr node represents expression followed by slice indices
export class SliceExpr implements ExprNode {
  Expr: ExprNode // expression
  Low: ExprNode | undefined // beginning of slice range or undefined
  High: ExprNode | undefined // end of slice range or undefined
  Max: ExprNode | undefined // maximum capacity of slice or undefined
  ThreeSlice: boolean // true if 2 colons present (3-index slice)

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(
    expr: ExprNode,
    low: ExprNode | undefined,
    high: ExprNode | undefined,
    max: ExprNode | undefined,
    isThree: boolean
  ) {
    this.Expr = expr
    this.Low = low
    this.High = high
    this.Max = max
    this.ThreeSlice = isThree
  }
}

// TypeAssertExpr node represents expression followed by type assertion
export class TypeAssertExpr implements ExprNode {
  Expr: ExprNode // expression
  Type: ExprNode | undefined // asserted type; if undefined, means type switch X.(type)

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TRUE / FALSE
    return 1
  }

  constructor(expr: ExprNode, type: ExprNode | undefined) {
    this.Expr = expr
    this.Type = type
  }
}

// CallExpr node represents expression followed by argument list
export class CallExpr implements ExprNode {
  Func: ExprNode // function expression
  Args: ExprNode[] | undefined // function arguments

  getType(): nodeType {
    return nodeType.CALL
  }

  valuesProduced(): number {
    return this.Func.valuesProduced()
  }

  constructor(func: ExprNode, args: ExprNode[] | undefined) {
    this.Func = func
    this.Args = args
  }
}

// StarExpr represents expression of "*" Expression
// Either a unary "*" exprression or a pointer type
export class StarExpr implements ExprNode {
  Expr: ExprNode // operand

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(expr: ExprNode) {
    this.Expr = expr
  }
}

// UnaryExpr node represents unary expression
// Unary "*" expressions represented via StarExpr
export class UnaryExpr implements ExprNode {
  Op: TokType.token // operator
  X: ExprNode //operand

  getType(): nodeType {
    return nodeType.UNARY
  }

  valuesProduced(): number {
    return 1
  }

  constructor(op: string, expr: ExprNode) {
    this.Op = TokType.getToken(op)
    this.X = expr
  }
}

// BinaryExpr node represents binary expression
export class BinaryExpr implements ExprNode {
  X: ExprNode // left operand
  Op: TokType.token // operator
  Y: ExprNode // right operand

  getType(): nodeType {
    return nodeType.BINARY
  }

  valuesProduced(): number {
    return 1
  }

  constructor(x: ExprNode, op: string, y: ExprNode) {
    this.X = x
    this.Op = TokType.getToken(op)
    this.Y = y
  }
}

// KeyValueExpr node represents (key : value) pairs
export class KeyValueExpr implements ExprNode {
  Key: ExprNode // key
  Value: ExprNode // value

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(key: ExprNode, val: ExprNode) {
    this.Key = key
    this.Value = val
  }
}

// Type represented by tree consisting of one or more type-specific expression nodes

// ArrayType node represents array or slice type
export class ArrayType implements ExprNode {
  Length: ExprNode | undefined // ellipsis node for [...]T array types, undefined for slices
  ElementType: ExprNode // element type

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(len: ExprNode | undefined, elmType: ExprNode) {
    this.Length = len
    this.ElementType = elmType
  }
}

// StructType node repesents struct type
export class StructType implements ExprNode {
  Fields: FieldList // list of field declarations
  Incomplete: boolean // true if source fields are missing in Fields

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(fields: FieldList, incomplete: boolean) {
    this.Fields = fields
    this.Incomplete = incomplete
  }
}

// FuncType node represents function type
export class FuncType implements ExprNode {
  Params: FieldList // parameters
  Results: FieldList | undefined // results or undefined

  numParams(): number {
    return this.Params.NumFields()
  }

  numResults(): number {
    if (this.Params === undefined) {
      return 0
    }
    return this.Params.NumFields()
  }

  valuesProduced(): number {
    // Types don't produce values
    return 0
  }

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(params: FieldList, results: FieldList | undefined) {
    this.Params = params
    this.Results = results
  }
}

// InterfaceType node represents interface type
export class InterfaceType implements ExprNode {
  Methods: FieldList // list of methods
  Incomplete: boolean // true if source methods missing in Methods list

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(methods: FieldList, incomplete: boolean) {
    this.Methods = methods
    this.Incomplete = incomplete
  }
}

// MapType node represents map type
export class MapType implements ExprNode {
  Key: ExprNode // key type
  Value: ExprNode // value type

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(key: ExprNode, val: ExprNode) {
    this.Key = key
    this.Value = val
  }
}

// ChanType node represents channel type
export class ChanType implements ExprNode {
  Direction: ChanDir // channel direction
  Value: ExprNode // value type

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  valuesProduced(): number {
    // TO FIX
    return 0
  }

  constructor(dir: ChanDir, val: ExprNode) {
    this.Direction = dir
    this.Value = val
  }
}

// Statements are represented by a tree consisting of one or more concrete statement nodes

// BadStmt node is a placeholder for statements consisting syntax errors
export class BadStmt implements StatementNode {
  getType(): nodeType {
    return nodeType.ILLEGAL
  }
}

// DeclStmt node represents declaration in statement list
export class DeclStmt implements StatementNode {
  Decl: DeclarationNode // GenDecl with CONST, TYPE, or VAR token

  getType(): nodeType {
    return nodeType.DECL
  }

  constructor(decl: DeclarationNode) {
    this.Decl = decl
  }
}

// EmptyStmt node represents empty statement
// position is the position of the semicolon (implicit/explicit) that immediately follows after
export class EmptyStmt implements StatementNode {
  Implicit: boolean // true if ";" omitted in source

  getType(): nodeType {
    return nodeType.EMPTY
  }

  constructor(implicit: boolean) {
    this.Implicit = implicit
  }
}

// LabeledStmt node represents labeled statement (e.g. goto End)
export class LabeledStmt implements StatementNode {
  Label: Ident // label
  Stmt: StatementNode // statement

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(label: Ident, stmt: StatementNode) {
    this.Label = label
    this.Stmt = stmt
  }
}

// ExprStmt node represents stand-alone expression in statement list
export class ExprStmt implements StatementNode {
  Expr: ExprNode // expression

  getType(): nodeType {
    return nodeType.EXPRSTMT
  }

  constructor(expr: ExprNode) {
    this.Expr = expr
  }
}

// SendStmt node represents send statement
export class SendStmt implements StatementNode {
  Chan: ExprNode // channel
  Value: ExprNode // expression to send

  getType(): nodeType {
    return nodeType.SEND
  }

  constructor(ch: ExprNode, val: ExprNode) {
    this.Chan = ch
    this.Value = val
  }
}

// IncDecStmt node represents increment or decrement statement
export class IncDecStmt implements StatementNode {
  Expr: ExprNode // value
  Tok: TokType.token // INC or DEC

  getType(): nodeType {
    return nodeType.INCDEC
  }

  constructor(expr: ExprNode, token: string) {
    this.Expr = expr
    this.Tok = TokType.getToken(token)
  }
}

// AssignStmt node represents assignment/short variable declaration
export class AssignStmt implements StatementNode {
  LeftHandSide: ExprNode[] // left hand expressions (multiple assignments)
  Tok: TokType.token // assignment token / DEFINE
  RightHandSide: ExprNode[] // expressions on right hand side
  LhsExprCount!: number // number of arguments on left hand side
  RhsValCount!: number // number of values produced on right hand side

  getType(): nodeType {
    return nodeType.ASSIGN
  }
  getTokType(): TokType.Token{
    return this.Tok
  }
    
  constructor(lhs: ExprNode[], token: string, rhs: ExprNode[]) {
    this.LeftHandSide = lhs
    this.Tok = TokType.getToken(token)
    this.RightHandSide = rhs
  }
}

// GoStmt node represents go statement
export class GoStmt implements StatementNode {
  Call: CallExpr // goroutine to start

  getType(): nodeType {
    return nodeType.GOSTMT
  }

  constructor(callExp: CallExpr) {
    this.Call = callExp
  }
}

// DeferStmt node represents defer statement
export class DeferStmt implements StatementNode {
  Call: CallExpr // expression to defer

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(callExp: CallExpr) {
    this.Call = callExp
  }
}

// ReturnStmt node represents return statement
export class ReturnStmt implements StatementNode {
  Results: ExprNode[] // result expressions or null

  getType(): nodeType {
    return nodeType.RETURN
  }

  constructor(results: ExprNode[]) {
    this.Results = results
  }
}

// BranchStmt node represents break/continue/goto/fallthrough
export class BranchStmt implements StatementNode {
  Tok: TokType.token // keyword token (BREAK, CONTINUE, GOTO, FALLTHROUGH)
  Label: Ident | undefined // label name or undefined

  getType(): nodeType {
    switch (this.Tok) {
      case TokType.token.BREAK:
        return nodeType.BREAK
      case TokType.token.CONTINUE:
        return nodeType.CONT
    }
    // GOTO and FALLTHROUGH not implemented
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(token: string, label: Ident | undefined) {
    this.Tok = TokType.getToken(token)
    this.Label = label
  }
}

// BlockStmt node represents braced statement list
export class BlockStmt implements StatementNode {
  List: StatementNode[] // list of statements

  getType(): nodeType {
    return nodeType.BLOCK
  }

  constructor(lst: StatementNode[]) {
    this.List = lst
  }
}

// IfStmt node represents if statement
export class IfStmt implements StatementNode {
  Init: StatementNode | undefined // initialisation statement or undefined
  Cond: ExprNode // condition
  Body: BlockStmt // consequent
  Else: StatementNode | undefined // alternative

  getType(): nodeType {
    return nodeType.IF
  }

  constructor(
    init: StatementNode | undefined,
    cond: ExprNode,
    body: BlockStmt,
    elseStm: StatementNode | undefined
  ) {
    this.Init = init
    this.Cond = cond
    this.Body = body
    this.Else = elseStm
  }
}

// CaseClause node represents case of expression/type switch statement
export class CaseClause implements StatementNode {
  List: ExprNode[] // list of expressions/types
  Body: StatementNode[] // body

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(lst: ExprNode[], body: StatementNode[]) {
    this.List = lst
    this.Body = body
  }
}

// SwitchStmt node represents expression switch statement
export class SwitchStmt implements StatementNode {
  Init: StatementNode | undefined // initialisation statement / undefined
  Tag: ExprNode | undefined // tag expression / undefined
  Body: BlockStmt // block of CaseClauses only

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(init: StatementNode | undefined, tag: ExprNode | undefined, body: BlockStmt) {
    this.Init = init
    this.Tag = tag
    this.Body = body
  }
}

// TypeSwitchStmt node represents type switch statement
export class TypeSwitchStmt implements StatementNode {
  Init: StatementNode | undefined // initialisation statement/undefined
  Assign: StatementNode // assignment statement or selector statement
  Body: BlockStmt // block of CaseClauses only

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(init: StatementNode | undefined, assign: StatementNode, body: BlockStmt) {
    this.Init = init
    this.Assign = assign
    this.Body = body
  }
}

// CommClause node represents case of select statement
export class CommClause implements StatementNode {
  Comm: StatementNode | undefined // send or receive statement, undefined for default case
  Body: StatementNode[] // statement list

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(comm: StatementNode | undefined, body: StatementNode[]) {
    this.Comm = comm
    this.Body = body
  }
}

// SelectStmt node represents select statement
export class SelectStmt implements StatementNode {
  Body: BlockStmt // CommClauses only

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(body: BlockStmt) {
    this.Body = body
  }
}

// ForStmt node represents for statement
export class ForStmt implements StatementNode {
  Init: StatementNode | undefined // initialisation statement/undefined
  Cond: ExprNode | undefined // condition/undefined
  Post: StatementNode | undefined // post iteration statement/undefined
  Body: BlockStmt // body

  getType(): nodeType {
    return nodeType.FOR
  }

  constructor(
    init: StatementNode | undefined,
    cond: ExprNode | undefined,
    post: StatementNode | undefined,
    body: BlockStmt
  ) {
    this.Init = init
    this.Cond = cond
    this.Post = post
    this.Body = body
  }
}

// RangeStmt represents for statement with range clause
export class RangeStmt implements StatementNode {
  Key: ExprNode | undefined // key expression/undefined
  Value: ExprNode | undefined // value expression/undefined
  Tok: TokType.token // ILLEGAL if Key is null, ASSIGN, DEFINE
  Expr: ExprNode // value to range over
  Body: BlockStmt // body

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(
    key: ExprNode | undefined,
    val: ExprNode | undefined,
    token: string,
    expr: ExprNode,
    body: BlockStmt
  ) {
    this.Key = key
    this.Value = val
    this.Tok = TokType.getToken(token)
    this.Expr = expr
    this.Body = body
  }
}

// Declarations

// Spec node represents single (non-parenthesised) constant, type, or variable declaration

// ValueSpec node represents constant or variable declaration (ConstSpec / VarSpec production)
export class ValueSpec implements SpecNode {
  Names: Ident[] // value names (guaranteed to be non-empty)
  Type: ExprNode | undefined // value type / undefined
  Values: ExprNode[] // initial values

  getType(): nodeType {
    return nodeType.VALUESPEC
  }

  constructor(names: Ident[], type: ExprNode | undefined, values: ExprNode[]) {
    this.Names = names
    this.Type = type
    this.Values = values
  }
}

// TypeSpec node represents type declaration (TypeSpec production)
export class TypeSpec implements SpecNode {
  Name: Ident // type name
  Type: ExprNode // Ident, ParentExpr, SelectorExpr, StarExpr, or any of the XxxTypes

  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor(name: Ident, type: ExprNode) {
    this.Name = name
    this.Type = type
  }
}

// placeholder
export class ImportSpec implements SpecNode {
  getType(): nodeType {
    return nodeType.NOT_IMPLEMENTED
  }

  constructor() {}
}

// Declarations are represented by one of the following declaration nodes

// BadDecl node is a placeholder for declarations containing syntax errors
export class BadDecl implements DeclarationNode {
  getType(): nodeType {
    return nodeType.ILLEGAL
  }
}

// GenDecl node (general declaration) represents a constant, type, or variable declaration
// If LeftParen position is valid, the declaration is parenthesised
export class GenDecl implements DeclarationNode {
  Tok: TokType.token // CONST/TYPE/VAR
  Specs: SpecNode[] // constant/variable declarations

  getType(): nodeType {
    return nodeType.GENDECL
  }
  getTokType(): TokType.Token {
   return this.Tok
  }

  constructor(token: string, specs: SpecNode[]) {
    this.Tok = TokType.getToken(token)
    this.Specs = specs
  }
}

// FuncDecl node represents a function declaration
export class FuncDecl implements DeclarationNode {
  Recv: FieldList | undefined // Receiver methods or undefined (functions)
  Name: Ident // function/method name
  Type: FuncType // function signature: parameters, results, position of "func" keyword
  Body: BlockStmt // function body

  getType(): nodeType {
    return nodeType.FUNCD
  }

  constructor(recv: FieldList | undefined, name: Ident, funcType: FuncType, body: BlockStmt) {
    this.Recv = recv
    this.Name = name
    this.Type = funcType
    this.Body = body
  }
}

// File node represents a Go source node
// This exists merely to read the root node returned by the parser
export class File implements GoNode {
  Decls: DeclarationNode[] // top-level declarations/nil
  Name: Ident // package name
  Unresolved: Ident[] // unresolved identifiers

  getType(): nodeType {
    return nodeType.FILE
  }

  constructor(decls: DeclarationNode[], name: Ident) {
    this.Decls = decls
    this.Name = name
    this.Unresolved = []
  }
}
