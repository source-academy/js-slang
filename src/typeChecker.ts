import * as es from 'estree'
// tslint:disable:no-console

/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 * @param context Additional context such as the week of our source program, comments etc.
 */
export function typeCheck(program: es.Program | undefined): void {
  if (program === undefined || program.body[0] === undefined) {
    return
  }
  // console.log(program)
  // console.log('Type of program is:')
  // console.log(infer(program.body[0], { next: 0, env: {} })[0])
  if (program.body[0].type === 'VariableDeclaration') {
    // console.log((program.body[0] as es.VariableDeclaration).declarations)
  } else if (program.body[0].type === 'ExpressionStatement') {
    // console.log((program.body[0] as es.ExpressionStatement).expression)
    // infer(program.body[0], { next: 0, env: {} })
  }
}

// Type Definitions
// interface Env {
//   [name: string]: TYPE
// }

// interface Ctx {
//   next: number
//   env: Env
// }

// interface Subsitution {
//   [key: string]: TYPE
// }

// function contains(type: TYPE, name: string): boolean {
//   switch (type.nodeType) {
//     case 'Named':
//       return false
//     case 'Var':
//       return type.name === name
//     case 'Function':
//       return contains(type.fromType, name) || contains(type.toType, name)
//   }
// }

// function bindTypeVarToType(nameOfTypeVar: string, type: TYPE): Subsitution {
//   if (type.nodeType === 'Var' && nameOfTypeVar === type.name) {
//     return {}
//   } else if (contains(type, nameOfTypeVar)) {
//     throw Error(
//       'Contains cyclic reference to itself, where the type being bound to is a function type'
//     )
//   }
//   return {
//     [nameOfTypeVar]: type
//   }
// }

// // Attempt to unify two types. If fails due to mismatch, throw error. Else
// // provide a substitution to apply unification to the context in the future
// function unify(t1: TYPE, t2: TYPE): Subsitution {
//   // Trivial case: Both are named types of the same kind
//   if (t1.nodeType === 'Named' && t2.nodeType === 'Named' && t1.name === t2.name) {
//     return {} // no substitution necessary
//   } else if (t1.nodeType === 'Var') {
//     // t1 is a type variable
//     return bindTypeVarToType(t1.name, t2)
//   } else if (t2.nodeType === 'Var') {
//     // t2 is a type variable
//     return bindTypeVarToType(t2.name, t1)
//   } else if (t1.nodeType === 'Function' && t2.nodeType === 'Function') {
//     // need to unify parameters types first and then body type
//     const argSubst = unify(t1.fromType, t2.fromType)
//     const bodySubst = unify(
//       applySubstToType(argSubst, t1.toType),
//       applySubstToType(argSubst, t2.toType)
//     )
//     return composeSubsitutions(argSubst, bodySubst)
//   } else {
//     // Mismatch
//     throw Error('Type Mismatch.')
//   }
// }

// function applySubstToType(subst: Subsitution, type: TYPE): TYPE {
//   switch (type.nodeType) {
//     case 'Named':
//       return type
//     case 'Var':
//       if (subst[type.name]) {
//         return subst[type.name]
//       } else {
//         return type
//       }
//     case 'Function':
//       return {
//         nodeType: 'Function',
//         fromType: applySubstToType(subst, type.fromType),
//         toType: applySubstToType(subst, type.toType)
//       }
//   }
// }

// function composeSubsitutions(s1: Subsitution, s2: Subsitution): Subsitution {
//   const composedSubst: Subsitution = {}
//   Object.keys(s2).forEach(key => {
//     composedSubst[key] = applySubstToType(s1, s2[key])
//   })
//   return { ...s1, ...composedSubst }
// }

// function applySubstToCtx(subst: Subsitution, ctx: Ctx): Ctx {
//   const newCtx = {
//     ...ctx,
//     env: {
//       ...ctx.env
//     }
//   }
//   Object.keys(newCtx.env).forEach(name => {
//     newCtx.env[name] = applySubstToType(subst, newCtx.env[name])
//   })
//   return newCtx
// }

// function addToCtx(ctx: Ctx, name: string, type: TYPE, createNexCtx: boolean): Ctx {
//   const newCtx = createNexCtx
//     ? {
//         ...ctx,
//         env: {
//           ...ctx.env
//         }
//       }
//     : ctx
//   newCtx.env[name] = type
//   return newCtx
// }

// function newTypeVar(ctx: Ctx): VAR {
//   const newVarId = ctx.next
//   ctx.next++
//   return {
//     nodeType: 'Var',
//     name: `TypeVar${newVarId}`
//   }
// }

// type NAMED_TYPE = 'boolean' | 'number' | 'string' | 'null' | 'undefined'

// interface NAMED {
//   nodeType: 'Named'
//   name: NAMED_TYPE
// }
// interface VAR {
//   nodeType: 'Var'
//   name: string
// }
// interface FUNCTION {
//   nodeType: 'Function'
//   fromType: TYPE // need to be an array when we have multiple arguments
//   toType: TYPE
// }
// type TYPE = NAMED | VAR | FUNCTION

// function infer(node: es.Node, ctx: Ctx): [TYPE, Subsitution] {
//   const env = ctx.env
//   switch (node.type) {
//     case 'ExpressionStatement': {
//       infer(node.expression, ctx)
//       return [{ nodeType: 'Named', name: 'undefined' }, {}]
//     }
//     case 'Literal': {
//       const literalVal = node.value
//       const typeOfLiteral = typeof literalVal
//       if (literalVal === null) {
//         return [{ nodeType: 'Named', name: 'null' }, {}]
//       } else if (
//         typeOfLiteral === 'boolean' ||
//         typeOfLiteral === 'string' ||
//         typeOfLiteral === 'number'
//       ) {
//         return [{ nodeType: 'Named', name: typeOfLiteral }, {}]
//       }
//       throw Error('Unexpected literal type')
//     }
//     case 'Identifier': {
//       const identifierName = node.name
//       if (env[identifierName]) {
//         return [env[identifierName], {}]
//       }
//       throw Error('Undefined identifier')
//     }
//     case 'ArrowFunctionExpression': {
//       const newType = newTypeVar(ctx)
//       // assuming function has exactly 1 parameter
//       const firstParam = node.params[0] as es.Identifier
//       const newCtx = addToCtx(ctx, firstParam.name, newType, true)
//       const inferredBody = infer(node.body, newCtx)
//       const [bodyType, subst] = inferredBody
//       const inferredType: FUNCTION = {
//         nodeType: 'Function',
//         fromType: applySubstToType(subst, newType),
//         toType: bodyType
//       }
//       console.log(inferredType)
//       return [inferredType, subst]
//     }
//     case 'VariableDeclaration': {
//       // forsee issues with recursive declarations
//       // assuming constant declaration for now (check the 'kind' field)
//       const declarator = node.declarations[0] // exactly 1 declaration allowed per line
//       const init = declarator.init
//       const id = declarator.id
//       if (!init || id.type !== 'Identifier') {
//         throw Error('Either no initialization or not an identifier on LHS')
//       }
//       const inferredInitType = infer(init, ctx)
//       addToCtx(ctx, id.name, inferredInitType[0], false)
//       return [{ nodeType: 'Named', name: 'undefined' }, {}]
//     }
//     case 'CallExpression': {
//       const [funcType, subst1] = infer(node.callee, ctx)
//       // assuming function has exactly 1 parameter
//       const [argType, subst2] = infer(node.arguments[0], applySubstToCtx(subst1, ctx))
//       const newType = newTypeVar(ctx)
//       const subst3 = composeSubsitutions(subst1, subst2)
//       // Check that our supposed function is an actual function and unify with literal fn type
//       const subst4 = unify({ nodeType: 'Function', fromType: argType, toType: newType }, funcType)
//       const funcType1 = applySubstToType(subst4, funcType)
//       if (funcType1.nodeType !== 'Function') {
//         throw Error('Expected callee to be of function type')
//       }
//       // consolidate all substitutions so far
//       const subst5 = composeSubsitutions(subst3, subst4)
//       // attempt to unify actual argument type with expected type
//       const subst6 = unify(applySubstToType(subst5, funcType1.fromType), argType)
//       // consolidate new substitutions
//       const finalSubst = composeSubsitutions(subst5, subst6)
//       const inferredReturnType = applySubstToType(finalSubst, funcType1.toType)
//       console.log(inferredReturnType)
//       console.log(finalSubst)
//       return [inferredReturnType, finalSubst]
//     }
//     default:
//       return [{ nodeType: 'Named', name: 'undefined' }, {}]
//   }
// }
