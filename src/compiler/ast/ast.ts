import * as nodes from "./nodes";
import { ChanDir } from "../ssa/types";

// Takes string representation of JSON AST and parses
// it into an AST using the node types defined in node.ts
function stringToAst(input : string) :  nodes.File {
    const jsonAst = JSON.parse(input);
    return parseFile(jsonAst);
}

function parseFile(file : any) : nodes.File {
    let declNodes : nodes.DeclarationNode[] = [];

    for (var decl of file["Decls"]) {
        declNodes.push(parseDecl(decl));
    }

    const name = parseIdentNode(file["Name"]);
    const packagePos : Pos.Pos = file["Package"];
    return new nodes.File(declNodes, packagePos, name);
}

function parseExprNode(node : any) : nodes.ExprNode {
    const nodeType = node["_type"];
    switch (nodeType) {
        case "Ident":
            return parseIdentNode(node);
        case "BasicLit":
            return parseBasicLit(node);
        case "CompositeLit":
            return parseCompositeLit(node);
        case "Ellipsis":
            return parseEllipsis(node);
        case "FuncLit":
            return parseFuncLit(node);
        case "FieldList":
            return parseFieldList(node);
        case "Field":
            return parseField(node);
        case "ParenExpr":
            return parseParenExpr(node);
        case "SelectorExpr":
            return parseSelectorExpr(node);
        case "IndexExpr":
            return parseIndexExpr(node);
        case "SliceExpr":
            return parseSliceExpr(node);
        case "TypeAssertExpr":
            return parseTypeAssert(node);
        case "CallExpr":
            return parseCallExpr(node);
        case "StarExpr":
            return parseStarExpr(node);
        case "UnaryExpr":
            return parseUnaryExpr(node);
        case "BinaryExpr":
            return parseBinaryExpr(node);
        case "KeyValueExpr":
            return parseKeyValExpr(node);
        case "ArrayType":
            return parseArrayType(node);
        case "StructType":
            return parseStructType(node);
        case "FuncType":
            return parseFuncType(node);
        case "InterfaceType":
            return parseInterfaceType(node);
        case "MapType":
            return parseMapType(node);
        case "ChanType":
            return parseChanType(node);
        default:
            throw new BadExprError(getStart(node));
    }
}

// Expr

function parseField(fi : any) : nodes.Field {
    let nameLst : nodes.Ident[] = [];
    for (var name of fi["Names"]) {
        nameLst.push(parseExprNode(name) as nodes.Ident);
    }

    let tag : nodes.BasicLit | undefined = undefined;
    if ("Tag" in fi) {
        tag = parseExprNode(fi["Tag"]) as nodes.BasicLit;
    }
    const type = parseExprNode(fi["Type"]);
    return new nodes.Field(nameLst, tag, type);
}

function parseFieldList(fl : any) : nodes.FieldList {
    const opening : Pos.Pos = fl["Opening"];
    const closing : Pos.Pos = fl["Closing"];
    let lst : nodes.Field[] | undefined = [];
    if ("List" in fl) {
        for (var field of fl["List"]) {
            lst.push(parseExprNode(field) as nodes.Field);
        }
    } else {
        lst = undefined;
    }
    return new nodes.FieldList(opening, lst, closing);
}

function parseIdentNode(node : any) : nodes.Ident {
    const namePos : Pos.Pos = node["NamePos"];
    const name : string = node["Name"];
    return new nodes.Ident(namePos, name);
}

function parseBasicLit(node : any) : nodes.BasicLit {
    const pos : Pos.Pos = node["ValuePos"];
    const kind : string = node["Kind"];
    const val : string = node["Value"];
    return new nodes.BasicLit(pos, kind, val);
}

function parseCompositeLit(node : any) : nodes.CompositeLit {
    const lbrace : Pos.Pos = node["Lbrace"];
    const rbrace : Pos.Pos = node["Rbrace"];

    let type : nodes.ExprNode | undefined = undefined; 
    if ("Type" in node) {
        type = parseExprNode(node["Type"]);
    }

    let elements : nodes.ExprNode[] = [];
    for (var elmt of node["Elts"]) {
        elements.push(parseExprNode(elmt));
    }
    const incomplete : boolean = node["Incomplete"];
    return new nodes.CompositeLit(type, lbrace, elements, rbrace, incomplete);
}

function parseEllipsis(node : any) : nodes.Ellipsis {
    const ellipPos : Pos.Pos = node["Ellipsis"];
    let elementType : nodes.ExprNode | undefined = undefined;
    if ("Elt" in node) {
        elementType = parseExprNode(node["Elt"]);
    }
    return new nodes.Ellipsis(ellipPos, elementType);
}

function parseFuncLit(node : any) : nodes.FuncLit {
    const type = parseExprNode(node["Type"]) as nodes.FuncType;
    const body = parseBlockStmt(node["Body"]) as nodes.BlockStmt;
    return new nodes.FuncLit(type, body);
}

function parseParenExpr(node : any) : nodes.ParenExpr {
    const lparen : Pos.Pos = node["Lparen"];
    const rparen : Pos.Pos = node["Rparen"];
    const expr = parseExprNode(node["X"]);
    return new nodes.ParenExpr(lparen, expr, rparen);
}

function parseSelectorExpr(node : any) : nodes.SelectorExpr {
    const expr = parseExprNode(node["X"]);
    const selector = parseExprNode(node["Sel"]) as nodes.Ident;
    return new nodes.SelectorExpr(expr, selector);
}

function parseIndexExpr(node : any) : nodes.IndexExpr {
    const lbrack : Pos.Pos = node["Lbrack"];
    const rbrack : Pos.Pos = node["Rbrack"];
    const expr = parseExprNode(node["X"]);
    const idx = parseExprNode(node["Index"]);
    return new nodes.IndexExpr(expr, lbrack, idx, rbrack);
}

function parseSliceExpr(node : any) : nodes.SliceExpr {
    const lbrack : Pos.Pos = node["Lbrack"];
    const rbrack : Pos.Pos = node["Rbrack"];
    const expr = parseExprNode(node["X"]);
    let low : nodes.ExprNode | undefined = undefined;
    let high : nodes.ExprNode | undefined = undefined;
    let max : nodes.ExprNode | undefined = undefined;
    if ("Low" in node) {
        low = parseExprNode(node["Low"]);
    }
    if ("High" in node) {
        high = parseExprNode(node["High"]);
    }
    if ("Max" in node) {
        max = parseExprNode(node["Max"]);
    }
    const threeSlice : boolean = node["Slice3"];
    return new nodes.SliceExpr(expr, lbrack, low, high, max, threeSlice, rbrack);
}

function parseTypeAssert(node : any) : nodes.TypeAssertExpr {
    const expr = parseExprNode(node["X"]);
    const lparen : Pos.Pos = node["Lparen"];
    const rparen : Pos.Pos = node["Rparen"];
    let type : nodes.ExprNode | undefined = undefined;
    if ("Type" in node) {
        type = parseExprNode(node["Type"]);
    }
    return new nodes.TypeAssertExpr(expr, lparen, type, rparen);
}

function parseCallExpr(node : any) : nodes.CallExpr {
    const fun = parseExprNode(node["Fun"]);
    const lparen : Pos.Pos = node["Lparen"];
    const ellipsis : Pos.Pos = node["Ellipsis"];
    const rparen : Pos.Pos = node["Rparen"];

    let args : nodes.ExprNode[] | undefined = [];
    if ("Args" in node) {
        for (var arg of node["Args"]) {
            args.push(parseExprNode(arg));
        }
    } else {
        args = undefined;
    }
    return new nodes.CallExpr(fun, lparen, args, ellipsis, rparen);
}

function parseStarExpr(node : any) : nodes.StarExpr {
    const star : Pos.Pos = node["Star"];
    const expr = parseExprNode(node["X"]);
    return new nodes.StarExpr(star, expr);
}

function parseUnaryExpr(node : any) : nodes.UnaryExpr {
    const pos : Pos.Pos = node["OpPos"];
    const op : string = node["Op"];
    const expr = parseExprNode(node["X"]);
    return new nodes.UnaryExpr(pos, op, expr);
}

function parseBinaryExpr(node : any) : nodes.BinaryExpr {
    const x = parseExprNode(node["X"]);
    const pos : Pos.Pos = node["OpPos"];
    const op : string = node["Op"];
    const y = parseExprNode(node["Y"]);
    return new nodes.BinaryExpr(x, pos, op, y);
}

function parseKeyValExpr(node : any) : nodes.KeyValueExpr {
    const key = parseExprNode(node["Key"]);
    const colonPos : Pos.Pos = node["Colon"];
    const val = parseExprNode(node["Value"]);
    return new nodes.KeyValueExpr(key, colonPos, val);
}

// Type

function parseArrayType(node : any) : nodes.ArrayType {
    const lbrack : Pos.Pos = node["Lbrack"];
    let len : nodes.ExprNode | undefined = undefined;
    if ("Len" in node) {
        len = parseExprNode(node["Len"]);
    }
    const elementType = parseExprNode(node["Elt"]);
    return new nodes.ArrayType(lbrack, len, elementType);
}

function parseStructType(node : any) : nodes.StructType {
    const pos : Pos.Pos = node["Struct"];
    const fields = parseExprNode(node["Fields"]) as nodes.FieldList;
    const incomplete : boolean = node["Incomplete"];
    return new nodes.StructType(pos, fields, incomplete);
}

function parseFuncType(node : any) : nodes.FuncType {
    const funcPos : Pos.Pos = node["Func"];
    const params = parseExprNode(node["Params"]) as nodes.FieldList;
    let results : nodes.FieldList | undefined = undefined;
    if ("Results" in node) {
        results = parseExprNode(node["Results"]) as nodes.FieldList;
    }
    return new nodes.FuncType(funcPos, params, results);
}

function parseInterfaceType(node : any) : nodes.InterfaceType {
    const pos : Pos.Pos = node["Interface"];
    const methods = parseExprNode(node["Methods"]) as nodes.FieldList;
    const incomplete : boolean = node["Incomplete"];
    return new nodes.InterfaceType(pos, methods, incomplete);
}

function parseMapType(node : any) : nodes.MapType {
    const pos : Pos.Pos = node["Map"];
    const key = parseExprNode(node["Key"]);
    const val = parseExprNode(node["Value"]);
    return new nodes.MapType(pos, key, val);
}

function parseChanType(node : any) : nodes.ChanType {
    const begin : Pos.Pos = node["Begin"];
    const arrow : Pos.Pos = node["Arrow"];
    const dir : ChanDir = node["Dir"];
    const val = parseExprNode(node["Value"]);
    return new nodes.ChanType(begin, arrow, dir, val);
}

// Statements

function parseStatement(node : any) : nodes.StatementNode {
    const type = node["_type"];
    switch (type) {
        case "DeclStmt":
            return parseDeclStmt(node);
        case "EmptyStmt":
            return parseEmptyStmt(node);
        case "LabeledStmt":
            return parseLabeledStmt(node);
        case "ExprStmt":
            return parseExprStmt(node);
        case "SendStmt":
            return parseSendStmt(node);
        case "IncDecStmt":
            return parseIncDecStmt(node);
        case "AssignStmt":
            return parseAssignStmt(node);
        case "GoStmt":
            return parseGoStmt(node);
        case "DeferStmt":
            return parseDeferStmt(node);
        case "ReturnStmt":
            return parseReturnStmt(node);
        case "BranchStmt":
            return parseBranchStmt(node);
        case "BlockStmt":
            return parseBlockStmt(node);
        case "IfStmt":
            return parseIfStmt(node);
        case "CaseClause":
            return parseCaseClause(node);
        case "SwitchStmt":
            return parseSwitchStmt(node);
        case "TypeSwitchStmt":
            return parseTypeSwitchStmt(node);
        case "CommClause":
            return parseCommClause(node);
        case "SelectStmt":
            return parseSelectStmt(node);
        case "ForStmt":
            return parseForStmt(node);
        case "RangeStmt":
            return parseRangeStmt(node);
        default:
            throw new BadStmtError(getStart(node));
    }
}

function parseDeclStmt(node : any) : nodes.DeclStmt {
    const decl = parseDecl(node["Decl"]);
    return new nodes.DeclStmt(decl);
}

function parseEmptyStmt(node : any) : nodes.EmptyStmt {
    const pos : Pos.Pos = node["Semicolon"];
    const implicit : boolean = node["Implicit"];
    return new nodes.EmptyStmt(pos, implicit);
}

function parseLabeledStmt(node : any) : nodes.LabeledStmt {
    const label = parseExprNode(node["Label"]) as nodes.Ident;
    const pos : Pos.Pos = node["Colon"];
    const stmt = parseStatement(node["Stmt"]);
    return new nodes.LabeledStmt(label, pos, stmt);
}

function parseExprStmt(node : any) : nodes.ExprStmt {
    const expr = parseExprNode(node["X"]);
    return new nodes.ExprStmt(expr);
}

function parseSendStmt(node : any) : nodes.SendStmt {
    const ch = parseExprNode(node["Chan"]);
    const arrow : Pos.Pos = node["Arrow"];
    const val = parseExprNode(node["Value"]);
    return new nodes.SendStmt(ch, arrow, val);
}

function parseIncDecStmt(node : any) : nodes.IncDecStmt {
    const expr = parseExprNode(node["X"]);
    const pos : Pos.Pos = node["TokPos"];
    const token : string = node["Tok"];
    return new nodes.IncDecStmt(expr, pos, token);
}

function parseAssignStmt(node : any) : nodes.AssignStmt {
    let lhs : nodes.ExprNode[] = [];
    let rhs : nodes.ExprNode[] = [];
    for (var lexp of node["Lhs"]) {
        lhs.push(parseExprNode(lexp));
    }
    for (var rexp of node["Rhs"]) {
        rhs.push(parseExprNode(rexp));
    }
    const pos : Pos.Pos = node["TokPos"];
    const token : string = node["Tok"];
    return new nodes.AssignStmt(lhs, pos, token, rhs);
}

function parseGoStmt(node : any) : nodes.GoStmt {
    const goPos : Pos.Pos = node["Go"];
    const callExp = parseExprNode(node["Call"]) as nodes.CallExpr;
    return new nodes.GoStmt(goPos, callExp);
}

function parseDeferStmt(node : any) : nodes.DeferStmt {
    const pos : Pos.Pos = node["Defer"];
    const callExp = parseExprNode(node["Call"]) as nodes.CallExpr;
    return new nodes.DeferStmt(pos, callExp);
}

function parseReturnStmt(node : any) : nodes.ReturnStmt {
    const pos : Pos.Pos = node["Return"];
    let results : nodes.ExprNode[] = [];
    for (var res of node["Results"]) {
        results.push(parseExprNode(res));
    }
    return new nodes.ReturnStmt(pos, results);
}

function parseBranchStmt(node : any) : nodes.BranchStmt {
    const pos : Pos.Pos = node["TokPos"];
    const token : string = node["Tok"];
    let label : nodes.Ident | undefined = undefined;
    if ("Label" in node) {
        label = parseExprNode(node["Label"]) as nodes.Ident;
    }
    return new nodes.BranchStmt(pos, token, label);
}

function parseBlockStmt(node : any) : nodes.BlockStmt {
    const lbrace : Pos.Pos = node["Lbrace"];
    const rbrace : Pos.Pos = node["Rbrace"];
    let lst : nodes.StatementNode[] = [];
    for (var stmt of node["List"]) {
        lst.push(parseStatement(stmt));
    }
    return new nodes.BlockStmt(lbrace, lst, rbrace);
}

function parseIfStmt(node : any) : nodes.IfStmt {
    const pos : Pos.Pos = node["If"];
    let init : nodes.StatementNode | undefined = undefined;
    if ("Init" in node) {
        init = parseStatement(node["Init"]);
    }
    const cond = parseExprNode(node["Cond"]);
    const body = parseStatement(node["Body"]) as nodes.BlockStmt;
    let elseStm : nodes.StatementNode | undefined = undefined;
    if ("Else" in node) {
        elseStm = parseStatement(node["Else"]);
    }
    return new nodes.IfStmt(pos, init, cond, body, elseStm);
}

function parseCaseClause(node : any) : nodes.CaseClause {
    const cse : Pos.Pos = node["Case"];
    const colon : Pos.Pos = node["Colon"];
    let lst : nodes.ExprNode[] = [];
    for (var exp of node["List"]) {
        lst.push(parseExprNode(exp));
    }
    let body : nodes.StatementNode[] = [];
    for (var stmt of node["Body"]) {
        body.push(parseStatement(stmt));
    }
    return new nodes.CaseClause(cse, lst, colon, body);
}

function parseSwitchStmt(node : any) : nodes.SwitchStmt {
    const pos : Pos.Pos = node["Switch"];
    const body = parseStatement(node["Body"]) as nodes.BlockStmt;
    let init : nodes.StatementNode | undefined = undefined;
    if ("Init" in node) {
        init = parseStatement(node["Init"]);
    }
    let tag : nodes.ExprNode | undefined = undefined;
    if ("Tag" in node) {
        tag = parseExprNode(node["Tag"]);
    }
    return new nodes.SwitchStmt(pos, init, tag, body);
}

function parseTypeSwitchStmt(node : any) : nodes.TypeSwitchStmt {
    const pos : Pos.Pos = node["Switch"];
    let init : nodes.StatementNode | undefined = undefined;
    if ("Init" in node) {
        init = parseStatement(node["Init"]);
    }
    const assign = parseStatement(node["Assign"]);
    const body = parseStatement(node["Body"]) as nodes.BlockStmt;
    return new nodes.TypeSwitchStmt(pos, init, assign, body);
}

function parseCommClause(node : any) : nodes.CommClause {
    const cse : Pos.Pos = node["Case"];
    let comm : nodes.StatementNode | undefined = undefined;
    if ("Comm" in node) {
        comm = parseStatement(node["Comm"]);
    }
    const colon : Pos.Pos = node["Colon"];
    let body : nodes.StatementNode[] = [];
    for (var stmt of node["Body"]) {
        body.push(parseStatement(stmt));
    }
    return new nodes.CommClause(cse, comm, colon, body);
}

function parseSelectStmt(node : any) : nodes.SelectStmt {
    const sel : Pos.Pos = node["Select"];
    const body = parseStatement(node["Body"]) as nodes.BlockStmt;
    return new nodes.SelectStmt(sel, body);
}

function parseForStmt(node : any) : nodes.ForStmt {
    const pos : Pos.Pos = node["For"];
    let init : nodes.StatementNode | undefined = undefined;
    if ("Init" in node) {
        init = parseStatement(node["Init"]);
    }
    let cond : nodes.ExprNode | undefined = undefined;
    if ("Cond" in node) {
        cond = parseExprNode(node["Cond"]);
    }
    let post : nodes.StatementNode | undefined = undefined;
    if ("Post" in node) {
        post = parseStatement(node["Post"]);
    }
    const body = parseStatement(node["Body"]) as nodes.BlockStmt;
    return new nodes.ForStmt(pos, init, cond, post, body);
}

function parseRangeStmt(node : any) : nodes.RangeStmt {
    const forPos : Pos.Pos = node["For"];
    let key : nodes.ExprNode | undefined = undefined;
    if ("Key" in node) {
        key = parseExprNode(node["Key"]);
    }
    let val : nodes.ExprNode | undefined = undefined;
    if ("Value" in node) {
        val = parseExprNode(node["Value"]);
    }
    const tokPos : Pos.Pos = node["TokPos"];
    const token : string = node["Tok"];
    const expr = parseExprNode(node["X"]);
    const body = parseStatement(node["Body"]) as nodes.BlockStmt;
    return new nodes.RangeStmt(forPos, key, val, tokPos, token, expr, body);
}

// Declarations

function parseDecl(decl : any) : nodes.DeclarationNode {
    const type : string = decl["_type"];
    switch (type) {
        case "GenDecl":
            return parseGenDecl(decl);
        case "FuncDecl":
            return parseFuncDecl(decl);
        default:
            throw new BadDeclError(getStart(decl));
    }
}

function parseGenDecl(decl : any) : nodes.GenDecl {
    const leftParen : Pos.Pos = decl["Lparen"];
    const rightParen : Pos.Pos = decl["Rparen"];
    let specList : nodes.SpecNode[] = [];
    for (var spec of decl["Specs"]) {
        specList.push(parseSpecNode(spec));
    }
    const token : string = decl["Tok"];
    const tokPos : Pos.Pos = getStart(decl);
    return new nodes.GenDecl(tokPos, token, leftParen, specList, rightParen);
}

function parseFuncDecl(decl: any) : nodes.FuncDecl {
    let recv : nodes.FieldList | undefined = undefined;
    if ("Recv" in decl) {
        recv = parseExprNode(decl["Recv"]) as nodes.FieldList;
    }
    const name = parseExprNode(decl["Name"]) as nodes.Ident;
    const type = parseExprNode(decl["Type"]) as nodes.FuncType;
    const body = parseStatement(decl["Body"]) as nodes.BlockStmt;
    return new nodes.FuncDecl(recv, name, type, body);
}

function parseSpecNode(node : any) : nodes.SpecNode  {
    const type : string = node["_type"];
    if (type === "ValueSpec") {
        return parseValueSpec(node);
    }
    if (type === "TypeSpec") { 
        return parseTypeSpec(node);
    }
    throw new BadSpecError(getStart(node));
}

function parseValueSpec(node : any) : nodes.ValueSpec {
    let names : nodes.Ident[] = [];
    for (var ident of node["Names"]) {
        names.push(parseExprNode(ident) as nodes.Ident);
    }

    let type : nodes.ExprNode | undefined = undefined;
    if ("Type" in node) {
        type = parseExprNode(node["Type"]);
    } 

    let valueList : nodes.ExprNode[] = [];
    for (var val of node["Values"]) {
        valueList.push(parseExprNode(val));
    }
    return new nodes.ValueSpec(names, type, valueList);
}

function parseTypeSpec(node : any) : nodes.TypeSpec {
    const assignPos : Pos.Pos = node["Assign"];
    const name = parseExprNode(node["Name"]) as nodes.Ident;
    const type = parseExprNode(node["Type"]);
    return new node.TypeSpec(name, assignPos, type);
}

function getStart(nodeObj : any) : number {
    return nodeObj["Loc"]["Start"]["Offset"];
}

function getEnd(nodeObj : any) : number {
    return nodeObj["Loc"]["End"]["Offset"];
}