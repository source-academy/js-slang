import { ChanDir } from '../types/types'
import { BadDeclError, BadExprError, BadSpecError, BadStmtError } from './errors'
import * as nodes from './nodes'

// Takes string representation of JSON AST and parses
// it into an AST using the node types defined in node.ts
export function stringToAst(input: string): nodes.File {
  const jsonAst = JSON.parse(input.replace(/\\/g,'\\'))
  return parseFile(jsonAst)
}

export function parseFile(file: any): nodes.File {
  let declNodes: nodes.DeclarationNode[] = []

  for (var decl of file['Decls']) {
    declNodes.push(parseDecl(decl))
  }

  const name = parseIdentNode(file['Name'])
  return new nodes.File(declNodes, name)
}

function parseExprNode(node: any): nodes.ExprNode {
  //console.log(node)
  /*
  if (node === null){
    return undefined;
  }
  */
  const nodeType = node['NodeType']
  switch (nodeType) {
    case 'Ident':
      return parseIdentNode(node)
    case 'BasicLit':
      return parseBasicLit(node)
    case 'CompositeLit':
      return parseCompositeLit(node)
    case 'Ellipsis':
      return parseEllipsis(node)
    case 'FuncLit':
      return parseFuncLit(node)
    case 'FieldList':
      return parseFieldList(node)
    case 'Field':
      return parseField(node)
    case 'ParenExpr':
      return parseParenExpr(node)
    case 'SelectorExpr':
      return parseSelectorExpr(node)
    case 'IndexExpr':
      return parseIndexExpr(node)
    case 'SliceExpr':
      return parseSliceExpr(node)
    case 'TypeAssertExpr':
      return parseTypeAssert(node)
    case 'CallExpr':
      return parseCallExpr(node)
    case 'StarExpr':
      return parseStarExpr(node)
    case 'UnaryExpr':
      return parseUnaryExpr(node)
    case 'BinaryExpr':
      return parseBinaryExpr(node)
    case 'KeyValueExpr':
      return parseKeyValExpr(node)
    case 'ArrayType':
      return parseArrayType(node)
    case 'StructType':
      return parseStructType(node)
    case 'FuncType':
      return parseFuncType(node)
    case 'InterfaceType':
      return parseInterfaceType(node)
    case 'MapType':
      return parseMapType(node)
    case 'ChanType':
      return parseChanType(node)
    default:
      throw new BadExprError()
  }
}

// Expr

function parseField(fi: any): nodes.Field {
  let nameLst: nodes.Ident[] = []
  if (fi['Names'] !== null){
    for (var name of fi['Names']) {
      nameLst.push(parseExprNode(name) as nodes.Ident)
    }
  }

  let tag: nodes.BasicLit | undefined = undefined
  if ('Tag' in fi) {
    tag = parseExprNode(fi['Tag']) as nodes.BasicLit
  }
  const type = parseExprNode(fi['Type'])
  return new nodes.Field(nameLst, tag, type)
}

function parseFieldList(fl: any): nodes.FieldList {
  let lst: nodes.Field[] | undefined = []
  if ('List' in fl && fl['List'] !== null) {
    for (var field of fl['List']) {
      //var field = fl["List"]; // only 1 List field!! not iterable!
      lst.push(parseExprNode(field) as nodes.Field)
    }
  } else {
    lst = undefined
  }
  return new nodes.FieldList(lst)
}

function parseIdentNode(node: any): nodes.Ident {
  const name: string = node['Name']
  return new nodes.Ident(name)
}

function parseBasicLit(node: any): nodes.BasicLit {
  const kind: string = node['Kind']
  const val: string = node['Value']
  return new nodes.BasicLit(kind, val)
}

function parseCompositeLit(node: any): nodes.CompositeLit {
  let type: nodes.ExprNode | undefined = undefined
  if ('Type' in node) {
    type = parseExprNode(node['Type'])
  }

  let elements: nodes.ExprNode[] = []
  for (var elmt of node['Elts']) {
    elements.push(parseExprNode(elmt))
  }
  const incomplete: boolean = node['Incomplete']
  return new nodes.CompositeLit(type, elements, incomplete)
}

function parseEllipsis(node: any): nodes.Ellipsis {
  let elementType: nodes.ExprNode | undefined = undefined
  if ('Elt' in node) {
    elementType = parseExprNode(node['Elt'])
  }
  return new nodes.Ellipsis(elementType)
}

function parseFuncLit(node: any): nodes.FuncLit {
  const type = parseExprNode(node['Type']) as nodes.FuncType
  const body = parseBlockStmt(node['Body']) as nodes.BlockStmt
  return new nodes.FuncLit(type, body)
}

function parseParenExpr(node: any): nodes.ParenExpr {
  const expr = parseExprNode(node['X'])
  return new nodes.ParenExpr(expr)
}

function parseSelectorExpr(node: any): nodes.SelectorExpr {
  const expr = parseExprNode(node['X'])
  const selector = parseExprNode(node['Sel']) as nodes.Ident
  return new nodes.SelectorExpr(expr, selector)
}

function parseIndexExpr(node: any): nodes.IndexExpr {
  const expr = parseExprNode(node['X'])
  const idx = parseExprNode(node['Index'])
  return new nodes.IndexExpr(expr, idx)
}

function parseSliceExpr(node: any): nodes.SliceExpr {
  const expr = parseExprNode(node['X'])
  let low: nodes.ExprNode | undefined = undefined
  let high: nodes.ExprNode | undefined = undefined
  let max: nodes.ExprNode | undefined = undefined
  if ('Low' in node) {
    low = parseExprNode(node['Low'])
  }
  if ('High' in node) {
    high = parseExprNode(node['High'])
  }
  if ('Max' in node) {
    max = parseExprNode(node['Max'])
  }
  const threeSlice: boolean = node['Slice3']
  return new nodes.SliceExpr(expr, low, high, max, threeSlice)
}

function parseTypeAssert(node: any): nodes.TypeAssertExpr {
  const expr = parseExprNode(node['X'])
  let type: nodes.ExprNode | undefined = undefined
  if ('Type' in node) {
    type = parseExprNode(node['Type'])
  }
  return new nodes.TypeAssertExpr(expr, type)
}

function parseCallExpr(node: any): nodes.CallExpr {
  const fun = parseExprNode(node['Fun'])

  let args: nodes.ExprNode[] | undefined = []
  if ('Args' in node && node['Args'] !== null) {
    for (var arg of node['Args']) {
      args.push(parseExprNode(arg))
    }
  } else {
    args = undefined
  }
  return new nodes.CallExpr(fun, args)
}

function parseStarExpr(node: any): nodes.StarExpr {
  const expr = parseExprNode(node['X'])
  return new nodes.StarExpr(expr)
}

function parseUnaryExpr(node: any): nodes.UnaryExpr {
  const op: string = node['Op']
  const expr = parseExprNode(node['X'])
  return new nodes.UnaryExpr(op, expr)
}

function parseBinaryExpr(node: any): nodes.BinaryExpr {
  const x = parseExprNode(node['X'])
  const op: string = node['Op']
  const y = parseExprNode(node['Y'])
  return new nodes.BinaryExpr(x, op, y)
}

function parseKeyValExpr(node: any): nodes.KeyValueExpr {
  const key = parseExprNode(node['Key'])
  const val = parseExprNode(node['Value'])
  return new nodes.KeyValueExpr(key, val)
}

// Type

function parseArrayType(node: any): nodes.ArrayType {
  let len: nodes.ExprNode | undefined = undefined
  if ('Len' in node) {
    len = parseExprNode(node['Len'])
  }
  const elementType = parseExprNode(node['Elt'])
  return new nodes.ArrayType(len, elementType)
}

function parseStructType(node: any): nodes.StructType {
  const fields = parseExprNode(node['Fields']) as nodes.FieldList
  const incomplete: boolean = node['Incomplete']
  return new nodes.StructType(fields, incomplete)
}

function parseFuncType(node: any): nodes.FuncType {
  const params = parseExprNode(node['Params']) as nodes.FieldList
  let results: nodes.FieldList | undefined = undefined
  if ('Results' in node && node['Results'] !== null) {
    results = parseExprNode(node['Results']) as nodes.FieldList
  }
  return new nodes.FuncType(params, results)
}

function parseInterfaceType(node: any): nodes.InterfaceType {
  const methods = parseExprNode(node['Methods']) as nodes.FieldList
  const incomplete: boolean = node['Incomplete']
  return new nodes.InterfaceType(methods, incomplete)
}

function parseMapType(node: any): nodes.MapType {
  const key = parseExprNode(node['Key'])
  const val = parseExprNode(node['Value'])
  return new nodes.MapType(key, val)
}

function parseChanType(node: any): nodes.ChanType {
  const dir: ChanDir = node['Dir']
  const val = parseExprNode(node['Value'])
  return new nodes.ChanType(dir, val)
}

// Statements

function parseStatement(node: any): nodes.StatementNode {
  const type = node['NodeType']
  switch (type) {
    case 'DeclStmt':
      return parseDeclStmt(node)
    case 'EmptyStmt':
      return parseEmptyStmt(node)
    case 'LabeledStmt':
      return parseLabeledStmt(node)
    case 'ExprStmt':
      return parseExprStmt(node)
    case 'SendStmt':
      return parseSendStmt(node)
    case 'IncDecStmt':
      return parseIncDecStmt(node)
    case 'AssignStmt':
      return parseAssignStmt(node)
    case 'GoStmt':
      return parseGoStmt(node)
    case 'DeferStmt':
      return parseDeferStmt(node)
    case 'ReturnStmt':
      return parseReturnStmt(node)
    case 'BranchStmt':
      return parseBranchStmt(node)
    case 'BlockStmt':
      return parseBlockStmt(node)
    case 'IfStmt':
      return parseIfStmt(node)
    case 'CaseClause':
      return parseCaseClause(node)
    case 'SwitchStmt':
      return parseSwitchStmt(node)
    case 'TypeSwitchStmt':
      return parseTypeSwitchStmt(node)
    case 'CommClause':
      return parseCommClause(node)
    case 'SelectStmt':
      return parseSelectStmt(node)
    case 'ForStmt':
      return parseForStmt(node)
    case 'RangeStmt':
      return parseRangeStmt(node)
    default:
      throw new BadStmtError()
  }
}

function parseDeclStmt(node: any): nodes.DeclStmt {
  const decl = parseDecl(node['Decl'])
  return new nodes.DeclStmt(decl)
}

function parseEmptyStmt(node: any): nodes.EmptyStmt {
  const implicit: boolean = node['Implicit']
  return new nodes.EmptyStmt(implicit)
}

function parseLabeledStmt(node: any): nodes.LabeledStmt {
  const label = parseExprNode(node['Label']) as nodes.Ident
  const stmt = parseStatement(node['Stmt'])
  return new nodes.LabeledStmt(label, stmt)
}

function parseExprStmt(node: any): nodes.ExprStmt {
  const expr = parseExprNode(node['X'])
  return new nodes.ExprStmt(expr)
}

function parseSendStmt(node: any): nodes.SendStmt {
  const ch = parseExprNode(node['Chan'])
  const val = parseExprNode(node['Value'])
  return new nodes.SendStmt(ch, val)
}

function parseIncDecStmt(node: any): nodes.IncDecStmt {
  const expr = parseExprNode(node['X'])
  const token: string = node['Tok']
  return new nodes.IncDecStmt(expr, token)
}

function parseAssignStmt(node: any): nodes.AssignStmt {
  let lhs: nodes.ExprNode[] = []
  let rhs: nodes.ExprNode[] = []
  for (var lexp of node['Lhs']) {
    lhs.push(parseExprNode(lexp))
  }
  for (var rexp of node['Rhs']) {
    rhs.push(parseExprNode(rexp))
  }
  const token: string = node['Tok']
  return new nodes.AssignStmt(lhs, token, rhs)
}

function parseGoStmt(node: any): nodes.GoStmt {
  const callExp = parseExprNode(node['Call']) as nodes.CallExpr
  return new nodes.GoStmt(callExp)
}

function parseDeferStmt(node: any): nodes.DeferStmt {
  const callExp = parseExprNode(node['Call']) as nodes.CallExpr
  return new nodes.DeferStmt(callExp)
}

function parseReturnStmt(node: any): nodes.ReturnStmt {
  let results: nodes.ExprNode[] = []
  for (var res of node['Results']) {
    results.push(parseExprNode(res))
  }
  return new nodes.ReturnStmt(results)
}

function parseBranchStmt(node: any): nodes.BranchStmt {
  const token: string = node['Tok']
  let label: nodes.Ident | undefined = undefined
  if ('Label' in node) {
    label = parseExprNode(node['Label']) as nodes.Ident
  }
  return new nodes.BranchStmt(token, label)
}

function parseBlockStmt(node: any): nodes.BlockStmt {
  let lst: nodes.StatementNode[] = []
  for (var stmt of node['List']) {
    lst.push(parseStatement(stmt))
  }
  return new nodes.BlockStmt(lst)
}

function parseIfStmt(node: any): nodes.IfStmt {
  let init: nodes.StatementNode | undefined = undefined
  if ('Init' in node) {
    init = parseStatement(node['Init'])
  }
  const cond = parseExprNode(node['Cond'])
  const body = parseStatement(node['Body']) as nodes.BlockStmt
  let elseStm: nodes.StatementNode | undefined = undefined
  if ('Else' in node) {
    elseStm = parseStatement(node['Else'])
  }
  return new nodes.IfStmt(init, cond, body, elseStm)
}

function parseCaseClause(node: any): nodes.CaseClause {
  let lst: nodes.ExprNode[] = []
  for (var exp of node['List']) {
    lst.push(parseExprNode(exp))
  }
  let body: nodes.StatementNode[] = []
  for (var stmt of node['Body']) {
    body.push(parseStatement(stmt))
  }
  return new nodes.CaseClause(lst, body)
}

function parseSwitchStmt(node: any): nodes.SwitchStmt {
  const body = parseStatement(node['Body']) as nodes.BlockStmt
  let init: nodes.StatementNode | undefined = undefined
  if ('Init' in node) {
    init = parseStatement(node['Init'])
  }
  let tag: nodes.ExprNode | undefined = undefined
  if ('Tag' in node) {
    tag = parseExprNode(node['Tag'])
  }
  return new nodes.SwitchStmt(init, tag, body)
}

function parseTypeSwitchStmt(node: any): nodes.TypeSwitchStmt {
  let init: nodes.StatementNode | undefined = undefined
  if ('Init' in node) {
    init = parseStatement(node['Init'])
  }
  const assign = parseStatement(node['Assign'])
  const body = parseStatement(node['Body']) as nodes.BlockStmt
  return new nodes.TypeSwitchStmt(init, assign, body)
}

function parseCommClause(node: any): nodes.CommClause {
  let comm: nodes.StatementNode | undefined = undefined
  if ('Comm' in node) {
    comm = parseStatement(node['Comm'])
  }
  let body: nodes.StatementNode[] = []
  for (var stmt of node['Body']) {
    body.push(parseStatement(stmt))
  }
  return new nodes.CommClause(comm, body)
}

function parseSelectStmt(node: any): nodes.SelectStmt {
  const body = parseStatement(node['Body']) as nodes.BlockStmt
  return new nodes.SelectStmt(body)
}

function parseForStmt(node: any): nodes.ForStmt {
  let init: nodes.StatementNode | undefined = undefined
  if ('Init' in node) {
    init = parseStatement(node['Init'])
  }
  let cond: nodes.ExprNode | undefined = undefined
  if ('Cond' in node) {
    cond = parseExprNode(node['Cond'])
  }
  let post: nodes.StatementNode | undefined = undefined
  if ('Post' in node) {
    post = parseStatement(node['Post'])
  }
  const body = parseStatement(node['Body']) as nodes.BlockStmt
  return new nodes.ForStmt(init, cond, post, body)
}

function parseRangeStmt(node: any): nodes.RangeStmt {
  let key: nodes.ExprNode | undefined = undefined
  if ('Key' in node) {
    key = parseExprNode(node['Key'])
  }
  let val: nodes.ExprNode | undefined = undefined
  if ('Value' in node) {
    val = parseExprNode(node['Value'])
  }
  const token: string = node['Tok']
  const expr = parseExprNode(node['X'])
  const body = parseStatement(node['Body']) as nodes.BlockStmt
  return new nodes.RangeStmt(key, val, token, expr, body)
}

// Declarations

function parseDecl(decl: any): nodes.DeclarationNode {
  const type: string = decl['NodeType']
  switch (type) {
    case 'GenDecl':
      return parseGenDecl(decl)
    case 'FuncDecl':
      return parseFuncDecl(decl)
    default:
      throw new BadDeclError()
  }
}

function parseGenDecl(decl: any): nodes.GenDecl {
  let specList: nodes.SpecNode[] = []
  for (var spec of decl['Specs']) {
    specList.push(parseSpecNode(spec))
  }
  const token: string = decl['Tok']
  return new nodes.GenDecl(token, specList)
}

function parseFuncDecl(decl: any): nodes.FuncDecl {
  //console.log(decl);
  let recv: nodes.FieldList | undefined = undefined
  /*
  // recv is probsbly for web http type stuff which we dont deal with
  // all Recv in funcDecls are nulls
  if ('Recv' in decl) {
    recv = parseExprNode(decl['Recv']) as nodes.FieldList
  }
  */
  const name = parseExprNode(decl['Name']) as nodes.Ident
  const type = parseExprNode(decl['Type']) as nodes.FuncType
  const body = parseStatement(decl['Body']) as nodes.BlockStmt
  return new nodes.FuncDecl(recv, name, type, body)
}

function parseSpecNode(node: any): nodes.SpecNode {
  const type: string = node['NodeType']
  if (type === 'ValueSpec') {
    return parseValueSpec(node)
  }
  if (type === 'TypeSpec') {
    return parseTypeSpec(node)
  }
  //console.log(node);
  throw new BadSpecError()
}

function parseValueSpec(node: any): nodes.ValueSpec {
  let names: nodes.Ident[] = []
  for (var ident of node['Names']) {
    names.push(parseExprNode(ident) as nodes.Ident)
  }

  let type: nodes.ExprNode | undefined = undefined
  if ('Type' in node && node['Type'] !== null) {
    type = parseExprNode(node['Type'])
  }

  let valueList: nodes.ExprNode[] = []
  for (var val of node['Values']) {
    valueList.push(parseExprNode(val))
  }
  return new nodes.ValueSpec(names, type, valueList)
}

function parseTypeSpec(node: any): nodes.TypeSpec {
  const name = parseExprNode(node['Name']) as nodes.Ident
  const type = parseExprNode(node['Type'])
  return new node.TypeSpec(name, type)
}
