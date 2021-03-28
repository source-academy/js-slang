import * as es from 'estree'
import { simple } from '../../utils/walkers'

// Set of reserved keywords in GLSL
const reservedKeywords = new Set<string>([
  'attribute', 'const', 'uniform', 'varying', 'break', 'continue', 'do', 'for', 'while', 'if', 'else', 'in', 'out',
  'inout', 'float', 'int', 'void', 'bool', 'true', 'false', 'lowp', 'mediump', 'highp', 'precision', 'invariant',
  'discard', 'return', 'mat2', 'mat3', 'mat4', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'bvec2', 'bvec3',
  'bvec4', 'sampler2D', 'samplerCubestruct', 'asm', 'class', 'union', 'enum', 'typedef', 'template', 'this', 'packed',
  'goto', 'switch', 'defaultinlinenoinline', 'volatile', 'public', 'static', 'extern', 'external', 'interface',
  'flat', 'long', 'short', 'double', 'half', 'fixed', 'unsigned', 'superp', 'input', 'output', 'hvec2', 'hvec3',
  'hvec4', 'dvec2', 'dvec3', 'dvec4', 'fvec2', 'fvec3', 'fvec4', 'sampler1D sampler3D', 'sampler1DShadow',
  'sampler2DShadow', 'sampler2DRect', 'sampler3DRect', 'sampler2DRectShadow', 'sizeof', 'castnamespace', 'using'
]);

/*
 * GPU function verifier helps to ensure the function is suitable for passing into GPU
 * Upon termination will update:
 *   @verifiedFunctions: a set of all functions that are already verified
 *   @unverifiedFunctions: a set of all functions that need to be verified
 */
class GPUFunctionVerifier {
  fun: es.Function
  name: string;
  verifiedFunctions: Set<string>;
  unverifiedFunctions: Set<string>;
  customFunctions: Map<string, es.FunctionDeclaration>;
  ok: boolean;

  /**
   *
   * @param fun function to be verified
   * @param name name of function to be verified
   * @param verifiedFunctions names of functions that have been verified
   * @param unverifiedFunctions names of functions yet to be verified
   * @param customFunctions map of function names to function declarations in the whole program
   * @param counters list of for loop counters (to check array assignment)
   */
  constructor(fun: es.Function, name: string, verifiedFunctions: Set<string>, unverifiedFunctions: Set<string>,
              customFunctions: Map<string, es.FunctionDeclaration>) {
    this.fun = fun;
    this.name = name;
    this.verifiedFunctions = verifiedFunctions;
    this.unverifiedFunctions = unverifiedFunctions;
    this.customFunctions = customFunctions;
    this.ok = this.checkFunction(fun);
  }

  /*
   * Checks if the function is valid
   * 1. No reserved keywords in GLSL used for the function name
   * 2. No modification of external variables
   * 3. No higher-order functions (functions as arguments)
   * 4. No recursive functions (this function should not call itself)
   * 5. No use of Source's standard library functions (other than math library)
   * 6. Any functions called inside this function have to obey these restrictions too
   */

  checkFunction = (fun: es.Function): boolean => {
    // 1. Check no reserved keywords in GLSL used for the function name
    if (reservedKeywords.has(this.name) || this.name.startsWith('__')) {
      return false
    }

    let ok: boolean = true;
    this.unverifiedFunctions.add(this.name);
    // 2. Check there is no modification of external variables

    // Get all local variables
    const localVar = new Set<string>()
    simple(fun.body, {
      VariableDeclaration(nx: es.VariableDeclaration) {
        if (nx.declarations[0].id.type === 'Identifier') {
          localVar.add(nx.declarations[0].id.name)
        }
      }
    })

    simple(fun.body, {
      AssignmentExpression(nx: es.AssignmentExpression) {
        // Check if there are assignments to non-local variables
        if (nx.left.type === 'Identifier' && !localVar.has(nx.left.name)) {
          ok = false
          return
        }
      }
    })

    if (!ok) {
      return false;
    }

    // Check that function calls within the function body are valid
    // 3. Check that no function calls are made using function params
    // 4, 5, 6. Check that function calls are to math_* OR other valid GPUFunctions
    const paramNames = new Set((fun.params as es.Identifier[]).map(x => x.name));
    const mathFuncCheck = new RegExp(/^math_[a-z]+$/)
    const verifiedFunctions = this.verifiedFunctions;
    const unverifiedFunctions = this.unverifiedFunctions;
    const customFunctions = this.customFunctions;
    simple(fun.body, {
      CallExpression(nx: es.CallExpression) {
        if (nx.callee.type !== 'Identifier') {
          ok = false
          return
        }

        // Check that params are not used for function application
        const functionName = nx.callee.name
        if (paramNames.has(functionName)) {
          ok = false
          return
        }

        // Check that function call is to math_*
        if (!mathFuncCheck.test(functionName)) {
          // Check that function call is to valid GPUFunction
          if (!verifiedFunctions.has(functionName)) {
            // If function is 'being verified' - there must be a recursive cycle - invalid
            if (unverifiedFunctions.has(functionName)) {
              ok = false
              return
            } else {
              // Else function is still unknown - we must verify it
              const fun2 = customFunctions.get(functionName)
              if (fun2 === undefined) {
                // Invalid function if it is not defined in program
                ok = false
                return
              }
              const verifier = new GPUFunctionVerifier(fun2, functionName, verifiedFunctions, unverifiedFunctions, customFunctions)
              if (!verifier.ok) {
                // If the recursive check fails, this function is also invalid
                ok = false
                return
              }
            }
          }
        }
      }
    })

    if (!ok) {
      return false;
    }

    // Update the verified and unverified sets of functions
    verifiedFunctions.add(this.name);
    unverifiedFunctions.delete(this.name);
    return true;
  }
}

export default GPUFunctionVerifier
