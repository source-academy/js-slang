import { nodeType } from "./ast/nodeTypes";
import * as nodes from "./ast/nodes";

let instrs : Instruction[];
let lidx : number;
let compileEnv : CompileEnvironment;

function compile(file : nodes.File) {
    instrs = [];
    lidx = 0;
    compileEnv = new CompileEnvironment();
    compileNode(file, compileEnv);
    instrs[lidx++] = new DoneInstruction;
}

function compileNode(node : nodes.GoNode, env : CompileEnvironment) {
    const type : nodeType = node.getType();
    switch (type) {
        case nodeType.BASIC_LIT:
            compileLiteral(node as nodes.BasicLit, env);
            break;
        case nodeType.IDENT:
            compileIdent(node as nodes.Ident, env);
            break;
        case nodeType.UNARY:
            compileUnaryOp(node as nodes.UnaryExpr, env);
            break;
        case nodeType.BINARY:
            compileBinaryOp(node as nodes.BinaryExpr, env);
            break;
        case nodeType.IF:
            compileIf(node as nodes.IfStmt, env);
            break;
        case nodeType.FOR:
            compileFor(node as nodes.ForStmt, env);
            break;
        case nodeType.CALL:
            compileCall(node as nodes.CallExpr, env);
            break;
    }
}

function compileLiteral(node : nodes.BasicLit, env : CompileEnvironment) {
    const tag = node.getDataType();
    switch (tag) {
        case Token.token.INT | Token.token.FLOAT:
            instrs[lidx++] = new BasicLitInstruction(tag, Number(node.Value));
            break;
        case Token.token.CHAR | Token.token.STRING:
            instrs[lidx++] = new BasicLitInstruction(tag, node.Value);
            break;
        case Token.token.IMAG:
            throw new Error("complex numbers unsupported");
    }
}

function compileIdent(node : nodes.Ident, env : CompileEnvironment) {
    instrs[lidx++] = new IdentInstruction(node.Name, 
        env.compile_time_environment_position(node.Name));
}

function compileUnaryOp(node : nodes.UnaryExpr, env : CompileEnvironment) {
    compileNode(node.X, env);
    instrs[lidx++] = new UnOpInstruction(node.Op);
}

function compileBinaryOp(node : nodes.BinaryExpr, env : CompileEnvironment) {
    const op = node.Op;
    const jofInst = new JumpOnFalseInstruction();
    const gotoInst = new GotoInstruction();
    switch (op) {
        case Token.token.AND:
            compileNode(node.X, env);
            instrs[lidx++] = jofInst;
            compileNode(node.Y, env);
            instrs[lidx++] = gotoInst;
            jofInst.setJumpDest(lidx);
            instrs[lidx++] = new IdentInstruction("false", env.compile_time_environment_position("false"));
            gotoInst.setGotoDest(lidx);
            break;
        case Token.token.OR:
            compileNode(node.X, env);
            instrs[lidx++] = jofInst;
            instrs[lidx++] = new IdentInstruction("true", env.compile_time_environment_position("true"));
            instrs[lidx++] = gotoInst;
            jofInst.setJumpDest(lidx);
            compileNode(node.Y, env);
            gotoInst.setGotoDest(lidx);
            break;
        default:
            compileNode(node.X, env);
            compileNode(node.Y, env);
            instrs[lidx++] = new BinOpInstruction(node.Op);
    }
}

function compileIf(node : nodes.IfStmt, env : CompileEnvironment) {
    if (node.Init !== undefined) {
        compileNode(node.Init, env);
    }
    compileNode(node.Cond, env);
    const jofInst = new JumpOnFalseInstruction();
    instrs[lidx++] = jofInst;
    compileNode(node.Body, env);
    jofInst.setJumpDest(lidx + 1);
    if (node.Else !== undefined) {
        const gotoInst = new GotoInstruction();
        instrs[lidx++] = gotoInst;
        compileNode(node.Else, env);
        gotoInst.setGotoDest(lidx);
    }
}

function compileFor(node : nodes.ForStmt, env : CompileEnvironment) {
    if (node.Init !== undefined) {
        compileNode(node.Init, env);
    }
    const loop_start = lidx;
    let jofInst : JumpOnFalseInstruction | undefined = undefined;
    if (node.Cond !== undefined) {
        compileNode(node.Cond, env);
        jofInst = new JumpOnFalseInstruction();
    }
    compileNode(node.Body, env);
    instrs[lidx++] = new IterEndInstruction();
    if (node.Post !== undefined) {
        compileNode(node.Post, env);
    }
    const nextIterInst = new GotoInstruction();
    nextIterInst.setGotoDest(loop_start);
    instrs[lidx++] = nextIterInst;
    instrs[lidx++] = new ForEndInstruction();
    if (jofInst !== undefined) {
        jofInst.setJumpDest(lidx);
    }
}

// Future TODO: Function calls support the spread operator - consider integration
function compileCall(node : nodes.CallExpr, env : CompileEnvironment) {
    let arity = 0;
    if (node.Args !== undefined) {
        for (var arg of node.Args) {
            compileNode(arg, env);
            ++arity;
        }
    }
    instrs[lidx++] = new CallInstruction(arity);
}