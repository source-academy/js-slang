import * as es from 'estree'
import { generate } from 'astring'
import * as create from '../utils/astCreator'
import { simple, recursive, WalkerCallback } from '../utils/walkers'
// transforms AST of program
// Philosophy/idea/design here: minimal(?) interference w the syntax. Only
// add necessary details/vars and leave most of the heavy lifing to the runtime

function unshadowVariables(program: es.Node) {
    const seenIds = new Set()
    const env = [{}]
    const genId = (name: string) => {
        let count = 0
        while(seenIds.has(`${name}_${count}`)) count++
        const newName = `${name}_${count}`
        seenIds.add(newName)
        env[0][name] = newName
        return newName
    }
    const unshadowFunctionInner = (node: es.FunctionDeclaration | es.ArrowFunctionExpression | es.FunctionExpression, s: undefined, callback: WalkerCallback<undefined>) => {
        env.unshift({...env[0]})
        for (const id of node.params as es.Identifier[]) {
            id.name = genId(id.name)
        }
        callback(node.body, undefined)
        env.shift()
    }
    recursive(program, [{}], {
        BlockStatement(node: es.BlockStatement, s: undefined, callback: WalkerCallback<undefined>) {
            env.unshift({...env[0]})
            for (const stmt of node.body) {
                callback(stmt, s)
            }
            env.shift()
        },
        VariableDeclarator(node: es.VariableDeclarator, s: undefined, callback: WalkerCallback<undefined>) {
            node.id = node.id as es.Identifier
            const newName = genId(node.id.name)
            node.id.name = newName
        },
        FunctionDeclaration(node: es.FunctionDeclaration, s: undefined, callback: WalkerCallback<undefined>) {
            node.id = node.id as es.Identifier
            node.id.name = genId(node.id.name)
            // note: params can shadow function name
            env.unshift({...env[0]})
            for (const id of node.params as es.Identifier[]) {
                id.name = genId(id.name)
            }
            callback(node.body, undefined)
            env.shift()
        },
        ForStatement(node: es.ForStatement, s: undefined, callback: WalkerCallback<undefined>) {
            env.unshift({...env[0]})
            if (node.init) callback(node.init, s)
            if (node.test) callback(node.test, s)
            if (node.update) callback(node.update, s)
            callback(node.body, s)
            env.shift()
        },
        ArrowFunctionExpression: unshadowFunctionInner,
        FunctionExpression: unshadowFunctionInner,
        Identifier(node: es.Identifier, s: undefined, callback: WalkerCallback<undefined>) {
            node.name = env[0][node.name]
        },
        AssignmentExpression(node: es.AssignmentExpression, s: undefined, callback: WalkerCallback<undefined>) {
            callback(node.left, s)
            callback(node.right, s)
        },

    })
}

export function getOriginalName(name: string) {
    let cutAt = name.length - 1
    while(name.charAt(cutAt) !== '_') cutAt--
    return name.slice(0, cutAt)
}

function findFunctionAndStateIds(program: es.Node) {
    // In the (unlikely) case the default ids are declared as variables in the code
    const seenIds = new Set()
    simple(program, {
        Identifier(node: es.Identifier) {
            seenIds.add(node)
        }
    })

    function generateUnusedId(name: string) {
        if (!seenIds.has(name)) {
            return name
        } else {
            for (let i = 0; i < 100; i++) {
                const newName = `${name}${i}`
                if (!seenIds.has(newName)) {
                    return newName
                }
            }
            // something fishy is going on. TODO how to handle
            return "_"
        }
    }
    const baseFunId = "__InfLoopFns" // TODO change?
    const baseStateId = "__InfLoopState"
    return [generateUnusedId(baseFunId), generateUnusedId(baseStateId)]
}

function callFunction(fun: string, functionsId: string) {
    return create.memberExpression(create.identifier(functionsId), fun)
}

function hybridizeBinaryUnaryOperations(program: es.Node, functionsId: string) {
    simple(program, {
        BinaryExpression(node: es.BinaryExpression) {
          const { operator, left, right } = node
          create.mutateToCallExpression(node, callFunction("evalB", functionsId), [
            create.literal(operator),
            left,
            right
          ])
        },
        UnaryExpression(node: es.UnaryExpression) {
          const { operator, argument } = node as es.UnaryExpression
          create.mutateToCallExpression(node, callFunction("evalU", functionsId), [
            create.literal(operator),
            argument
          ])
        }
      })
}

function trackVariableRetrieval(program: es.Node, functionsId: string, stateId: string) { // TODO rename
    recursive(program, undefined, {
        Identifier(node: es.Identifier, state: undefined, callback: WalkerCallback<undefined>) {
            create.mutateToCallExpression(node, callFunction("hybridize", functionsId), [
                create.literal(node.name),
                create.identifier(node.name),
                create.identifier(stateId)
            ])
        },
        CallExpression(node: es.CallExpression, state: undefined, callback: WalkerCallback<undefined>) {
            // ignore callee
            for(const arg of node.arguments) {
                callback(arg, state)
            }
        },
    })
}

function trackVariableAssignment(program: es.Node, functionsId: string, stateId: string) { // TODO rename
    simple(program, {
        AssignmentExpression(node: es.AssignmentExpression) {
            if (node.left.type === 'Identifier') {
                node.right = create.callExpression(callFunction("saveVar", functionsId), [
                    create.literal(node.left.name),
                    node.right,
                    create.identifier(stateId)
                ])
            } else if (node.left.type === 'MemberExpression') {
                // BIG TODO
            }
        }
    })
}

function saveTheTest(node: es.IfStatement | es.ConditionalExpression | es.WhileStatement | es.ForStatement, functionsId: string, stateId: string) {
    if (node.test === null || node.test === undefined) {
        return
    }
    const newTest = create.callExpression(callFunction("saveBool", functionsId), [
        node.test,
        create.identifier(stateId)
    ])
    node.test = newTest
}

function inPlaceEnclose(node: es.Statement, prepend?: es.Statement, append?: es.Statement) {
    const shallowCopy = {...node}
    node.type = 'BlockStatement'
    node = node as es.BlockStatement
    node.body = [shallowCopy]
    if(prepend !== undefined) {
        node.body.unshift(prepend)
    }
    if(append !== undefined) {
        node.body.push(append)
    }
}

function trackIfStatements(program: es.Node, functionsId: string, stateId: string) {
    const theFunction = (node: es.IfStatement | es.ConditionalExpression) => saveTheTest(node, functionsId, stateId)
    simple(program, { IfStatement: theFunction, ConditionalExpression: theFunction })
}

function savePositionAsExpression(position: es.SourceLocation | undefined | null) {
    let result: es.Expression = create.identifier("undefined")
    if (position !== undefined && position !== null) {
        result = create.arrayExpression([create.literal(position.start.line), create.literal(position.start.column)])
    }
    return result
}

function trackLoops(program: es.Node, functionsId: string, stateId: string) {
    const makeCallStatement = (name: string, args: es.Expression[]) => create.expressionStatement(create.callExpression(callFunction(name, functionsId), args))
    const stateExpr = create.identifier(stateId)
    simple(program, {
        WhileStatement: (node: es.WhileStatement) => {
            saveTheTest(node, functionsId, stateId)
            inPlaceEnclose(node.body, undefined, makeCallStatement("postLoop", [stateExpr]))
            inPlaceEnclose(node, makeCallStatement("enterLoop", [savePositionAsExpression(node.loc), stateExpr]), makeCallStatement("exitLoop", [stateExpr]))
        },
        ForStatement: (node: es.ForStatement) => {
            saveTheTest(node, functionsId, stateId)
            const theUpdate = node.update? node.update : create.identifier('undefined')
            node.update = create.callExpression(callFunction("postLoop", functionsId), [stateExpr, theUpdate])
            inPlaceEnclose(node, makeCallStatement("enterLoop", [savePositionAsExpression(node.loc), stateExpr]), makeCallStatement("exitLoop", [stateExpr]))
        }
    })
}

function trackFunctions(program: es.Node, functionsId: string, stateId: string) {
    const preFunction = (name: string, params: es.Pattern[], position: es.SourceLocation | undefined | null) => {
        const args = params.filter(x=>x.type === 'Identifier')
                           .map(x=>(x as es.Identifier).name)
                           .map(x=>create.arrayExpression([create.literal(x), create.identifier(x)]))
        
        return create.expressionStatement(
            create.callExpression(callFunction("preFunction", functionsId), [
                create.literal(name),
                savePositionAsExpression(position),
                create.arrayExpression(args),
                create.identifier(stateId)
            ])
        )
    }
    
    let counter = 0
    const anonFunction = (node: es.ArrowFunctionExpression | es.FunctionExpression) => {
        const bodyAsStatement = node.body.type === 'BlockStatement' ? node.body : create.expressionStatement(node.body)
        inPlaceEnclose(bodyAsStatement, preFunction(`anon${counter++}`, node.params, node.loc))
    }
    simple(program, {
        ArrowFunctionExpression: anonFunction,
        FunctionExpression: anonFunction,
        FunctionDeclaration(node: es.FunctionDeclaration){
            const name = (node.id as es.Identifier).name
            inPlaceEnclose(node.body, preFunction(name, node.params, node.loc))
        },
        ReturnStatement(node: es.ReturnStatement) {
            const arg = node.argument === null || node.argument === undefined? create.identifier("undefined") : node.argument
            node.argument = create.callExpression(callFunction("returnFunction", functionsId), [arg, create.identifier(stateId)])
        }
    })
}

// TODO naming? way to standardize/link w runtime names
// TODO: add timeout stuff (same as transpiler, take note of system time)
// TODO: add tail recursion
// TODO: transform logical?
// TODO: tests

export function instrument(program: es.Node): [string, string, string] {
    unshadowVariables(program) // TODO big test this
    const [functionsId, stateId] = findFunctionAndStateIds(program)
    hybridizeBinaryUnaryOperations(program, functionsId)
    trackVariableRetrieval(program, functionsId, stateId)
    trackVariableAssignment(program, functionsId, stateId)
    trackIfStatements(program, functionsId, stateId)
    trackLoops(program, functionsId, stateId)
    trackFunctions(program, functionsId, stateId)
    const code = generate(program)
    return [code, functionsId, stateId]
}