import { MAX_LIST_DISPLAY_LENGTH } from '../constants'
import Closure from '../interpreter/closure'
import { Type, Value } from '../types'
import { forceIt } from './operators'

export interface ArrayLike {
  replPrefix: string
  replSuffix: string
  replArrayContents: () => Value[]
}

function isArrayLike(v: Value) {
  return (
    typeof v.replPrefix === 'string' &&
    typeof v.replSuffix === 'string' &&
    typeof v.replArrayContents === 'function'
  )
}

export const stringify = (
  value: Value,
  indent: number | string = 2,
  splitlineThreshold = 80
): string => {
  value = forceIt(value)
  if (typeof indent === 'string') {
    throw 'stringify with arbitrary indent string not supported'
  }
  let indentN: number = indent
  if (indent > 10) {
    indentN = 10
  }
  return lineTreeToString(stringDagToLineTree(valueToStringDag(value), indentN, splitlineThreshold))
}

export function typeToString(type: Type): string {
  return niceTypeToString(type)
}

function niceTypeToString(type: Type, nameMap = { _next: 0 }): string {
  function curriedTypeToString(t: Type) {
    return niceTypeToString(t, nameMap)
  }

  switch (type.kind) {
    case 'primitive':
      return type.name
    case 'variable':
      if (type.constraint && type.constraint !== 'none') {
        return type.constraint
      }
      if (!(type.name in nameMap)) {
        // type name is not in map, so add it
        nameMap[type.name] = 'T' + nameMap._next++
      }
      return nameMap[type.name]
    case 'list':
      return `List<${curriedTypeToString(type.elementType)}>`
    case 'array':
      return `Array<${curriedTypeToString(type.elementType)}>`
    case 'pair':
      const headType = curriedTypeToString(type.headType)
      // convert [T1 , List<T1>] back to List<T1>
      if (
        type.tailType.kind === 'list' &&
        headType === curriedTypeToString(type.tailType.elementType)
      )
        return `List<${headType}>`
      return `[${curriedTypeToString(type.headType)}, ${curriedTypeToString(type.tailType)}]`
    case 'function':
      let parametersString = type.parameterTypes.map(curriedTypeToString).join(', ')
      if (type.parameterTypes.length !== 1 || type.parameterTypes[0].kind === 'function') {
        parametersString = `(${parametersString})`
      }
      return `${parametersString} -> ${curriedTypeToString(type.returnType)}`
    default:
      return 'Unable to infer type'
  }
}

/**
 *
 * stringify problem overview
 *
 * We need a fast stringify function so that display calls are fast.
 * However, we also want features like nice formatting so that it's easy to read the output.
 *
 * Here's a sample of the kind of output we want:
 *
 *     > build_list(10, x => build_list(10, x=>x));
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [ [0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]],
 *     [[0, [1, [2, [3, [4, [5, [6, [7, [8, [9, null]]]]]]]]]], null]]]]]]]]]]
 *
 * Notice that relatively short lists that can fit on a single line
 * are simply placed on the same line.
 * Pairs have the first element indented, but the second element on the same level.
 * This allows lists to be displayed vertically.
 *
 *     > x => { return x; };
 *     x => {
 *       return x;
 *     }
 *
 * Functions simply have .toString() called on them.
 * However, notice that this sometimes creates a multiline string.
 * This means that when we have a pair that contains a multiline function,
 * we should put the two elements on different lines, even if the total number of characters is small:
 *
 *     > pair(x => { return x; }, 0);
 *     [ x => {
 *         return x;
 *       },
 *     0]
 *
 * Notice that the multiline string needs two spaces added to the start of every line, not just the first line.
 * Also notice that the opening bracket '[' takes up residence inside the indentation area,
 * so that the element itself is fully on the same indentation level.
 *
 * Furthermore, deeper indentation levels should just work:
 *
 *     > pair(pair(x => { return x; }, 0), 0);
 *     [ [ x => {
 *           return x;
 *         },
 *       0],
 *     0]
 *
 * Importantly, note we have to be able to do this indentation quickly, with a linear time algorithm.
 * Thus, simply doing the indentation every time we need to would be too slow,
 * as it may take O(n) time per indentation, and so O(n^2) time overall.
 *
 * Arrays are not the same as pairs, and they indent every element to the same level:
 *     > [1, 2, x => { return x; }];
 *     [ 1,
 *       2,
 *       x => {
 *         return x;
 *       }]
 *
 * Some data structures are "array-like",
 * so we can re-use the same logic for arrays, objects, and lists.
 *
 *     > display_list(list(1, list(2, 3), x => { return x; }));
 *     list(1,
 *          list(2, 3),
 *          x => {
 *            return x;
 *          })
 *
 *     > { a: 1, b: true, c: () => 1, d: { e: 5, f: 6 }, g: 0, h: 0, i: 0, j: 0, k: 0, l: 0, m: 0, n: 0};
 *     { "a": 1,
 *       "b": true,
 *       "c": () => 1,
 *       "d": {"e": 5, "f": 6},
 *       "g": 0,
 *       "h": 0,
 *       "i": 0,
 *       "j": 0,
 *       "k": 0,
 *       "l": 0,
 *       "m": 0,
 *       "n": 0}
 *
 * Notice the way that just like pairs,
 * short lists/objects are placed on the same line,
 * while longer lists/objects, or ones that are necessarily multiline,
 * are split into multiple lines, with one element per line.
 *
 * It is also possible to create data structures with large amounts of sharing
 * as well as cycles. Here is an example of a cyclic data structure with sharing:
 *
 *     > const x = pair(1, 'y');
 *     > const y = pair(2, 'z');
 *     > const z = pair(3, 'x');
 *     > set_tail(x, y);
 *     > set_tail(y, z);
 *     > set_tail(z, x);
 *     > display_list(list(x, y, z));
 *      list([1, [2, [3, ...<circular>]]],
 *           [2, [3, [1, ...<circular>]]],
 *           [3, [1, [2, ...<circular>]]])
 *
 * It might be difficult to maximise sharing in the face of cycles,
 * because when we cut a cycle, we have to replace a node somewhere with "...<circular>"
 * However, doing this means that a second pointer into this cyclic data structure
 * might have the "...<circular>" placed too early,
 * so we need to re-generate a different representation of the cyclic data structure for every possible root.
 * Otherwise, a naive memoization approach might generate the following output:
 *
 *      list([1, [2, [3, ...<circular>]]],
 *           [2, [3, ...<circular>]],
 *           [3, ...<circular>])
 *
 * which might be confusing if we interpret this to mean that the cycles have different lengths,
 * while in fact they each have length 3.
 *
 * It would be good if we can maximise sharing so that as much of the workload
 * scales with respect to the size of the input as opposed to the output.
 *
 * In summary, here are the list of challenges:
 *
 *  1) Avoid repeated string concatenation.
 *  2) Also avoid repeated multiline string indenting.
 *  3) Intelligently format values as either single line or multiline,
 *     depending on whether it contains any multiline elements,
 *     or whether it's too long and should be broken up.
 *  4) Indentation columns have to expand to fit array-like prefix strings,
 *     when they are longer than the indentation size (see display_list examples).
 *  5) Correctly handle cyclic data structures.
 *  6) Ideally, maximise re-use of shared data structures.
 *
 */

/**
 *
 * stringify notes on other implementations
 *
 * Python's pretty printer (pprint) has a strategy of stringifying each value at most twice.
 * The first time, it will assume that the value fits on a single line and simply calls repr.
 * If the repr is too long, then it'll format the value with pretty print rules
 * in multiple lines and with nice indentation.
 *
 * Theoretically, the repr can be memoized and so repr is called at most once on every value.
 * (In practice, I don't know if they actually do this)
 *
 * This gives us a nice bound of every value being repr'd at most once,
 * and every position in the output is pretty printed at most once.
 * With the string builder pattern, each can individually be done in O(n) time,
 * and so the algorithm as a whole runs in O(n) time.
 *
 */

/**
 *
 * stringify high level algorithm overview
 *
 * The algorithm we'll use is not quite the same as Python's algorithm but should work better or just as well.
 *
 * First we solve the problem of memoizing cyclic data structures by not solving the problem.
 * We keep a flag that indicates whether a particular value is cyclic, and only memoize values that are acyclic.
 * It is possible to use a strongly connected components style algorithm to speed this up,
 * but I haven't implemented it yet to keep the algorithm simple,
 * and it's still fast enough even in the cyclic case.
 *
 * This first step converts the value graph into a printable DAG.
 * To assemble this DAG into a single string, we have a second memo table
 * mapping each node of the printable DAG to its corresponding string representation,
 * but where lines are split and indentation is represented with a wrapper object that reifies
 * the action of incrementing the indentation level.
 * By handling the actual calculation of indentation levels outside this representation,
 * we can re-use string representations that are shared among different parts of the graph,
 * which may be on different indentation levels.
 *
 * With this data structure, we can easily build the partial string representations bottom up,
 * deferring the final calculation and printing of indentation levels to a straightforward final pass.
 *
 * In summary, here are the passes we have to make:
 *
 * - value graph -> string dag (resolves cycles, stringifies terminal nodes, leaves nonterminals abstract, computes lengths)
 * - string dag -> line based representation (pretty prints "main" content to lines, while leaving indentation / prefixes in general abstract)
 * - line based representation -> final string (basically assemble all the indentation strings together with the content strings)
 *
 * Memoization is added at every level so printing of extremely shared data structures
 * approaches the speed of string concatenation/substring in the limit.
 *
 */

interface TerminalStringDag {
  type: 'terminal'
  str: string
  length: number
}

interface MultilineStringDag {
  type: 'multiline'
  lines: string[]
  length: number
}

interface PairStringDag {
  type: 'pair'
  head: StringDag
  tail: StringDag
  length: number
}

interface ArrayLikeStringDag {
  type: 'arraylike'
  prefix: string
  elems: StringDag[]
  suffix: string
  length: number
}

interface KvPairStringDag {
  type: 'kvpair'
  key: string
  value: StringDag
  length: number
}

type StringDag =
  | TerminalStringDag
  | MultilineStringDag
  | PairStringDag
  | ArrayLikeStringDag
  | KvPairStringDag

export function valueToStringDag(value: Value): StringDag {
  const ancestors: Map<Value, number> = new Map()
  const memo: Map<Value, StringDag> = new Map()
  function convertPair(value: Value): [StringDag, boolean] {
    const memoResult = memo.get(value)
    if (memoResult !== undefined) {
      return [memoResult, false]
    }
    ancestors.set(value, ancestors.size)
    const elems: Value[] = value
    const [headDag, headIsCircular] = convert(elems[0])
    const [tailDag, tailIsCircular] = convert(elems[1])
    const isCircular = headIsCircular || tailIsCircular
    ancestors.delete(value)
    const result: StringDag = {
      type: 'pair',
      head: headDag,
      tail: tailDag,
      length: headDag.length + tailDag.length + 4
    }
    if (!isCircular) {
      memo.set(value, result)
    }
    return [result, isCircular]
  }

  function convertArrayLike(
    value: Value,
    elems: Value[],
    prefix: string,
    suffix: string
  ): [StringDag, boolean] {
    const memoResult = memo.get(value)
    if (memoResult !== undefined) {
      return [memoResult, false]
    }
    ancestors.set(value, ancestors.size)
    const converted = elems.map(convert)
    let length = prefix.length + suffix.length + Math.max(0, converted.length - 1) * 2
    let isCircular = false
    for (let i = 0; i < converted.length; i++) {
      if (converted[i] == null) {
        // the `elems.map` above preserves the sparseness of the array
        converted[i] = convert(undefined)
      }
      length += converted[i][0].length
      isCircular ||= converted[i][1]
    }
    ancestors.delete(value)
    const result: StringDag = {
      type: 'arraylike',
      elems: converted.map(c => c[0]),
      prefix: prefix,
      suffix: suffix,
      length: length
    }
    if (!isCircular) {
      memo.set(value, result)
    }
    return [result, isCircular]
  }

  function convertObject(value: Value): [StringDag, boolean] {
    const memoResult = memo.get(value)
    if (memoResult !== undefined) {
      return [memoResult, false]
    }
    ancestors.set(value, ancestors.size)
    const entries = Object.entries(value)
    const converted = entries.map(kv => convert(kv[1]))
    let length = 2 + Math.max(0, entries.length - 1) * 2 + entries.length * 2
    let isCircular = false
    const kvpairs: StringDag[] = []
    for (let i = 0; i < converted.length; i++) {
      length += entries[i][0].length
      length += converted[i].length
      isCircular ||= converted[i][1]
      kvpairs.push({
        type: 'kvpair',
        key: entries[i][0],
        value: converted[i][0],
        length: converted[i][0].length + entries[i][0].length
      })
    }
    ancestors.delete(value)
    const result: StringDag = {
      type: 'arraylike',
      elems: kvpairs,
      prefix: '{',
      suffix: '}',
      length: length
    }
    if (!isCircular) {
      memo.set(value, result)
    }
    return [result, isCircular]
  }

  function convertRepr(repr: string): [StringDag, boolean] {
    const lines: string[] = repr.split('\n')
    return lines.length === 1
      ? [{ type: 'terminal', str: lines[0], length: lines[0].length }, false]
      : [{ type: 'multiline', lines, length: Infinity }, false]
  }

  function convert(v: Value): [StringDag, boolean] {
    if (v === null) {
      return [{ type: 'terminal', str: 'null', length: 4 }, false]
    } else if (v === undefined) {
      return [{ type: 'terminal', str: 'undefined', length: 9 }, false]
    } else if (ancestors.has(v)) {
      return [{ type: 'terminal', str: '...<circular>', length: 13 }, true]
    } else if (v instanceof Closure) {
      return convertRepr(v.toString())
    } else if (typeof v === 'string') {
      const str = JSON.stringify(v)
      return [{ type: 'terminal', str: str, length: str.length }, false]
    } else if (typeof v !== 'object') {
      return convertRepr(v.toString())
    } else if (ancestors.size > MAX_LIST_DISPLAY_LENGTH) {
      return [{ type: 'terminal', str: '...<truncated>', length: 14 }, false]
    } else if (typeof v.toReplString === 'function') {
      return convertRepr(v.toReplString())
    } else if (Array.isArray(v)) {
      if (v.length === 2) {
        return convertPair(v)
      } else {
        return convertArrayLike(v, v, '[', ']')
      }
    } else if (isArrayLike(v)) {
      return convertArrayLike(v, v.replArrayContents(), v.replPrefix, v.replSuffix)
    } else {
      // use prototype chain to check if it is literal object
      return Object.getPrototypeOf(v) === Object.prototype
        ? convertObject(v)
        : convertRepr(v.toString())
    }
  }

  return convert(value)[0]
}

interface BlockLineTree {
  type: 'block'
  prefixFirst: string
  prefixRest: string
  block: LineTree[]
  suffixRest: string
  suffixLast: string
}

interface LineLineTree {
  type: 'line'
  line: StringDag
}

type LineTree = BlockLineTree | LineLineTree

export function stringDagToLineTree(
  dag: StringDag,
  indent: number,
  splitlineThreshold: number
): LineTree {
  // precompute some useful strings
  const indentSpacesMinusOne = ' '.repeat(Math.max(0, indent - 1))
  const bracketAndIndentSpacesMinusOne = '[' + indentSpacesMinusOne
  const memo: Map<StringDag, LineTree> = new Map()
  function format(dag: StringDag): LineTree {
    const memoResult = memo.get(dag)
    if (memoResult !== undefined) {
      return memoResult
    }
    let result: LineTree
    if (dag.type === 'terminal') {
      result = { type: 'line', line: dag }
    } else if (dag.type === 'multiline') {
      result = {
        type: 'block',
        prefixFirst: '',
        prefixRest: '',
        block: dag.lines.map(s => ({
          type: 'line',
          line: { type: 'terminal', str: s, length: s.length }
        })),
        suffixRest: '',
        suffixLast: ''
      }
    } else if (dag.type === 'pair') {
      const headTree = format(dag.head)
      const tailTree = format(dag.tail)
      // - 2 is there for backward compatibility
      if (
        dag.length - 2 > splitlineThreshold ||
        headTree.type !== 'line' ||
        tailTree.type !== 'line'
      ) {
        result = {
          type: 'block',
          prefixFirst: bracketAndIndentSpacesMinusOne,
          prefixRest: '',
          block: [headTree, tailTree],
          suffixRest: ',',
          suffixLast: ']'
        }
      } else {
        result = {
          type: 'line',
          line: dag
        }
      }
    } else if (dag.type === 'arraylike') {
      const elemTrees = dag.elems.map(format)
      if (
        dag.length - dag.prefix.length - dag.suffix.length > splitlineThreshold ||
        elemTrees.some(t => t.type !== 'line')
      ) {
        result = {
          type: 'block',
          prefixFirst: dag.prefix + ' '.repeat(Math.max(0, indent - dag.prefix.length)),
          prefixRest: ' '.repeat(Math.max(dag.prefix.length, indent)),
          block: elemTrees,
          suffixRest: ',',
          suffixLast: dag.suffix
        }
      } else {
        result = {
          type: 'line',
          line: dag
        }
      }
    } else if (dag.type === 'kvpair') {
      const valueTree = format(dag.value)
      if (dag.length > splitlineThreshold || valueTree.type !== 'line') {
        result = {
          type: 'block',
          prefixFirst: '',
          prefixRest: '',
          block: [
            { type: 'line', line: { type: 'terminal', str: JSON.stringify(dag.key), length: 0 } },
            valueTree
          ],
          suffixRest: ':',
          suffixLast: ''
        }
      } else {
        result = {
          type: 'line',
          line: dag
        }
      }
    } else {
      throw 'up'
    }
    memo.set(dag, result)
    return result
  }

  return format(dag)
}

export function stringDagToSingleLine(dag: StringDag): string {
  function print(dag: StringDag, total: string[]): string[] {
    if (dag.type === 'multiline') {
      throw 'Tried to format multiline string as single line string'
    } else if (dag.type === 'terminal') {
      total.push(dag.str)
    } else if (dag.type === 'pair') {
      total.push('[')
      print(dag.head, total)
      total.push(', ')
      print(dag.tail, total)
      total.push(']')
    } else if (dag.type === 'kvpair') {
      total.push(JSON.stringify(dag.key))
      total.push(': ')
      print(dag.value, total)
    } else if (dag.type === 'arraylike') {
      total.push(dag.prefix)
      if (dag.elems.length > 0) {
        print(dag.elems[0], total)
      }
      for (let i = 1; i < dag.elems.length; i++) {
        total.push(', ')
        print(dag.elems[i], total)
      }
      total.push(dag.suffix)
    }
    return total
  }

  return print(dag, []).join('')
}

export function lineTreeToString(tree: LineTree): string {
  let total = ''
  const stringDagToLineMemo: Map<StringDag, string> = new Map()
  const stringDagToMultilineMemo: Map<LineTree, Map<number, [number, number]>> = new Map()
  function print(tree: LineTree, lineSep: string) {
    const multilineMemoResult = stringDagToMultilineMemo.get(tree)
    if (multilineMemoResult !== undefined) {
      const startEnd = multilineMemoResult.get(lineSep.length)
      if (startEnd !== undefined) {
        total += total.substring(startEnd[0], startEnd[1])
        return
      }
    }
    const start = total.length
    if (tree.type === 'line') {
      if (!stringDagToLineMemo.has(tree.line)) {
        stringDagToLineMemo.set(tree.line, stringDagToSingleLine(tree.line))
      }
      total += stringDagToLineMemo.get(tree.line)!
    } else if (tree.type === 'block') {
      total += tree.prefixFirst
      const indentedLineSepFirst = lineSep + ' '.repeat(tree.prefixFirst.length)
      const indentedLineSepRest = lineSep + tree.prefixRest
      print(tree.block[0], indentedLineSepFirst)
      for (let i = 1; i < tree.block.length; i++) {
        total += tree.suffixRest
        total += indentedLineSepRest
        print(tree.block[i], indentedLineSepRest)
      }
      total += tree.suffixLast
    }
    const end = total.length
    if (multilineMemoResult === undefined) {
      const newmap = new Map()
      newmap.set(lineSep.length, [start, end])
      stringDagToMultilineMemo.set(tree, newmap)
    } else {
      multilineMemoResult.set(lineSep.length, [start, end])
    }
  }

  print(tree, '\n')

  return total
}
