import { BasicEvaluator, IRunnerPlugin } from '@sourceacademy/conductor/runner';
import type { Identifier, RestElement } from 'estree';

import Closure from '../cse-machine/closure';
import { Control, generateCSEMachineStateStream, Stash } from '../cse-machine/interpreter';
import { InstrType } from '../cse-machine/types';
import { createContext, parseError } from '../index';
import { Chapter } from '../langs';
import preprocessFileImports from '../modules/preprocessor';
import type { Context, Environment, Value } from '../types';
import { stringify } from '../utils/stringify';
import * as seq from '../utils/statementSeqTransform';
import {
  type CseSerializedEnvFrame,
  type CseSerializedInstruction,
  type CseSerializedValue,
  type CseSnapshot,
} from '@sourceacademy/common-cse-machine';
import { CseMachinePlugin } from '@sourceacademy/runner-cse-machine';

// ── Value serialisation ───────────────────────────────────────────────────────

function serializeValue(v: Value, depth = 0): CseSerializedValue {
  if (v instanceof Closure) {
    const paramNames = v.node.params.map((p: Identifier | RestElement) =>
      p.type === 'RestElement' ? '...' + (p.argument as Identifier).name : p.name,
    );
    const funcName = v.declaredName ?? v.functionName;
    return {
      displayValue: funcName,
      label: 'closure',
      metadata: { closureFrameId: v.environment.id, params: paramNames, funcName },
    };
  }

  if (Array.isArray(v)) {
    if (depth > 2) return { displayValue: '[...]', label: 'array' };
    const items = (v as Value[]).map(el => serializeValue(el, depth + 1));
    return {
      displayValue: stringify(v),
      label: 'array',
      metadata: {
        elements: items,
        id: (v as any).id,
        envId: (v as any).environment?.id ?? null,
      },
    };
  }

  if (v === null) return { displayValue: 'null', label: 'null' };
  if (v === undefined) return { displayValue: 'undefined', label: 'undefined' };

  switch (typeof v) {
    case 'number':  return { displayValue: String(v), label: 'number' };
    case 'string':  return { displayValue: `"${v}"`, label: 'string' };
    case 'boolean': return { displayValue: String(v), label: 'boolean' };
    // Native (builtin) functions reach here — label them 'builtin' so the adapter
    // doesn't try to reconstruct them as closures (which would produce null environments).
    case 'function': return { displayValue: stringify(v), label: 'builtin' };
    default:        return { displayValue: stringify(v), label: typeof v };
  }
}

// ── Control serialisation ─────────────────────────────────────────────────────

const INSTR_DISPLAY: Partial<Record<InstrType, string>> = {
  [InstrType.RESET]:            'return',
  [InstrType.POP]:              'pop',
  [InstrType.ASSIGNMENT]:       'assign',
  [InstrType.UNARY_OP]:         'unary op',
  [InstrType.BINARY_OP]:        'binary op',
  [InstrType.APPLICATION]:      'call',
  [InstrType.BRANCH]:           'branch',
  [InstrType.WHILE]:            'while',
  [InstrType.FOR]:              'for',
  [InstrType.CONTINUE]:         'continue',
  [InstrType.CONTINUE_MARKER]:  'mark',
  [InstrType.BREAK]:            'break',
  [InstrType.BREAK_MARKER]:     'mark',
  [InstrType.ARRAY_LITERAL]:    'arr lit',
  [InstrType.ARRAY_ACCESS]:     'arr acc',
  [InstrType.ARRAY_ASSIGNMENT]: 'arr asgn',
  [InstrType.ARRAY_LENGTH]:     'arr len',
  [InstrType.MARKER]:           'marker',
  [InstrType.SPREAD]:           'spread',
};

// Extract the full source text between two positions (multi-line aware).
function extractSourceRange(source: string, loc: any): string | null {
  if (!loc?.start || !source) return null;
  const lines = source.split('\n');
  const sl = loc.start.line - 1;
  const el = (loc.end?.line ?? loc.start.line) - 1;
  const sc = loc.start.column ?? 0;
  if (sl < 0 || sl >= lines.length) return null;
  if (sl === el) {
    const ec = loc.end?.column ?? lines[sl].length;
    return lines[sl].slice(sc, ec).trim() || null;
  }
  const chunks = [lines[sl].slice(sc)];
  for (let i = sl + 1; i < el && i < lines.length; i++) chunks.push(lines[i]);
  if (el < lines.length) chunks.push(lines[el].slice(0, loc.end?.column ?? lines[el].length));
  return chunks.join('\n').trim() || null;
}

// Minimal AST→string for nodes synthesised by the CSE machine (no source loc).
function nodeToString(node: any): string {
  if (!node) return '?';
  switch (node.type) {
    case 'VariableDeclaration': {
      const d = node.declarations?.[0];
      const id = d?.id?.name ?? '?';
      const init = d?.init ? nodeToString(d.init) : undefined;
      return `${node.kind ?? 'const'} ${id}${init !== undefined ? ` = ${init}` : ''}`;
    }
    case 'ArrowFunctionExpression': {
      const params = (node.params ?? []).map((p: any) =>
        p.type === 'RestElement' ? `...${p.argument?.name ?? '?'}` : (p.name ?? '?'),
      ).join(', ');
      const paramsStr = (node.params?.length ?? 0) === 1 ? params : `(${params})`;
      const body = node.body?.type === 'BlockStatement'
        ? `{\n${(node.body.body ?? []).map((s: any) => '  ' + nodeToString(s)).join('\n')}\n}`
        : nodeToString(node.body);
      return `${paramsStr} => ${body}`;
    }
    case 'BlockStatement':
      return `{\n${(node.body ?? []).map((s: any) => '  ' + nodeToString(s)).join('\n')}\n}`;
    case 'ReturnStatement':
      return `return${node.argument ? ' ' + nodeToString(node.argument) : ''};`;
    case 'ExpressionStatement':
      return nodeToString(node.expression) + ';';
    case 'Identifier': return node.name ?? '?';
    case 'Literal':    return JSON.stringify(node.value);
    case 'BinaryExpression':
      return `${nodeToString(node.left)} ${node.operator} ${nodeToString(node.right)}`;
    case 'UnaryExpression':
      return `${node.operator}${nodeToString(node.argument)}`;
    case 'CallExpression': {
      const args = (node.arguments ?? []).map(nodeToString).join(', ');
      return `${nodeToString(node.callee)}(${args})`;
    }
    case 'ArrayExpression':
      return `[${(node.elements ?? []).map(nodeToString).join(', ')}]`;
    case 'MemberExpression':
      return node.computed
        ? `${nodeToString(node.object)}[${nodeToString(node.property)}]`
        : `${nodeToString(node.object)}.${nodeToString(node.property)}`;
    default: return node.type ?? '?';
  }
}

function serializeControlItem(item: any, source?: string): CseSerializedInstruction {
  if (item?.instrType !== undefined) {
    // ENVIRONMENT handled specially — adapter looks it up by envId, no instrType needed.
    if (item.instrType === InstrType.ENVIRONMENT && item.env?.id) {
      return { displayText: 'ENVIRONMENT', metadata: { envId: item.env.id as string } };
    }
    if (item.instrType === InstrType.ASSIGNMENT && item.symbol) {
      return { displayText: `assign ${item.symbol}`, metadata: { instrType: item.instrType, symbol: item.symbol as string } };
    }
    if (item.instrType === InstrType.APPLICATION && item.numOfArgs !== undefined) {
      return { displayText: `call ${item.numOfArgs}`, metadata: { instrType: item.instrType, numOfArgs: item.numOfArgs as number } };
    }
    // ArrLitInstr uses .arity (not .numOfElements)
    if (item.instrType === InstrType.ARRAY_LITERAL && item.arity !== undefined) {
      return { displayText: `arr lit ${item.arity}`, metadata: { instrType: item.instrType, arity: item.arity as number } };
    }
    if (item.instrType === InstrType.BINARY_OP && item.symbol) {
      return { displayText: item.symbol as string, metadata: { instrType: item.instrType } };
    }
    if (item.instrType === InstrType.UNARY_OP && item.symbol) {
      return { displayText: item.symbol as string, metadata: { instrType: item.instrType } };
    }
    const displayText = INSTR_DISPLAY[item.instrType as InstrType] ?? String(item.instrType);
    return { displayText, metadata: { instrType: item.instrType } };
  }

  if (item?.type !== undefined) {
    const loc = item.loc;
    let displayText: string;

    if (item.type === 'BlockStatement' || item.type === 'Program') {
      const body = extractSourceRange(source ?? '', loc);
      displayText = body
        ? `{\n${body.split('\n').map(l => '  ' + l).join('\n')}\n}`
        : '{ ... }';
    } else if (item.type === 'StatementSequence') {
      displayText = extractSourceRange(source ?? '', loc) ?? '...';
    } else if (item.type === 'VariableDeclaration') {
      displayText = nodeToString(item);
    } else if (item.type === 'ArrowFunctionExpression') {
      displayText = nodeToString(item);
    } else {
      displayText = extractSourceRange(source ?? '', loc) ?? nodeToString(item);
    }

    // Serialize node type metadata so the adapter can reconstruct proper fake nodes
    // for the animation system (instead of falling back to a generic Identifier).
    const isBlockLike = item.type === 'BlockStatement' || item.type === 'Program' || item.type === 'StatementSequence';
    const animMeta: Record<string, unknown> = { nodeType: item.type as string };
    if (isBlockLike && Array.isArray(item.body)) {
      animMeta.bodyLength = item.body.length;
      animMeta.bodyNodeTypes = (item.body as any[]).map((n: any) => n?.type as string | undefined);
    }

    if (loc?.start && loc?.end) {
      return { displayText, metadata: { ...animMeta, startLine: loc.start.line as number, endLine: loc.end.line as number } };
    }
    return { displayText, metadata: animMeta };
  }

  return { displayText: '<unknown>' };
}

// ── Environment serialisation ─────────────────────────────────────────────────

function serializeEnvChain(
  callStackEnvs: Environment[],
  stashItems: Value[],
  rawControl: any[],
): CseSerializedEnvFrame[] {
  const seen = new Set<string>();
  const queue: Environment[] = [];

  const visit = (env: Environment | null | undefined) => {
    if (!env || seen.has(env.id)) return;
    seen.add(env.id);
    queue.push(env);
    visit(env.tail);
    for (const val of Object.values(env.head)) {
      if (val instanceof Closure) visit(val.environment);
    }
  };

  for (const env of callStackEnvs) visit(env);
  for (const val of stashItems) {
    if (val instanceof Closure) visit(val.environment);
  }
  for (const item of rawControl) {
    if (item?.instrType === InstrType.ENVIRONMENT && item.env) visit(item.env as Environment);
  }

  const callStackIds = new Set(callStackEnvs.map(e => e.id));

  return queue.map(env => {
    // The global env (id='-1', name='global') carries all Source builtins put there by
    // defineBuiltin/defineSymbol. These are noisy — hide its bindings but keep the frame
    // itself so the environment chain renders correctly.
    // programEnvironment and all inner frames contain user-defined variables and must show bindings.
    const isGlobalEnv = env.id === '-1' || (env.name === 'global' && env.tail === null);
    const bindings = isGlobalEnv
      ? []
      : Object.entries(Object.getOwnPropertyDescriptors(env.head))
          .filter(([, desc]) =>
            // Hide native builtin functions (not Closure instances)
            !(typeof desc.value === 'function' && !(desc.value instanceof Closure)),
          )
          .map(([name, desc]) => ({
            name,
            // Uninitialized const placeholder (Symbol) — pass as special 'unassigned' label
            // so the adapter can reconstruct Symbol('const declaration') for Frame.tsx.
            value: typeof desc.value === 'symbol'
              ? { displayValue: '', label: 'unassigned' }
              : serializeValue(desc.value as Value),
            isConst: desc.writable === false,
          }));

    // Serialize closures/arrays in the frame's heap that are NOT already referenced via
    // a named head binding.  These are "anonymous" heap objects (e.g. a lambda returned
    // from a function before being assigned) that the visualizer shows as dangling arrows
    // from the frame — getUnreferencedObjects() looks them up via env.heap.
    const headValues = new Set(Object.values(env.head));
    const heapObjects = isGlobalEnv
      ? []
      : [...env.heap.getHeap()]
          .filter(obj => obj instanceof Closure && !headValues.has(obj))
          .map(obj => serializeValue(obj as Value));

    return {
      id: env.id,
      name: env.name,
      parentId: env.tail?.id ?? null,
      bindings,
      heapObjects: heapObjects.length > 0 ? heapObjects : undefined,
      isActive: env.id === callStackEnvs[0]?.id,
      isOnCallStack: callStackIds.has(env.id),
    };
  });
}

// ── Snapshot collection ───────────────────────────────────────────────────────

// Quick structural fingerprint for deduplication — only hashes displayText/displayValue
// which is what the user actually sees. Two steps with identical fingerprints are visually
// identical even if internal interpreter state differs.
function snapshotFingerprint(snap: CseSnapshot): string {
  const ctrl = snap.control.map(i => i.displayText).join('|');
  const stsh = snap.stash.map(v => v.displayValue).join('|');
  const envs = snap.environments.map(e =>
    e.id + ':' + e.bindings.map(b => b.name + '=' + b.value.displayValue).join(','),
  ).join(';');
  return `${ctrl}§${stsh}§${envs}`;
}

async function collectSnapshots(context: Context, control: Control, stash: Stash, source: string, maxSnapshots: number = 1000): Promise<CseSnapshot[]> {
  const snapshots: CseSnapshot[] = [];

  // Capture the initial state BEFORE the generator runs its first step.
  // The Program handler processes the whole program in one step (creating programEnvironment,
  // hoisting names, pushing StatementSequence), so the generator's first yield already shows
  // the "opened" block. We manually capture the Program node on control here so the user
  // sees step 1 as { <literal source> } — matching the non-conductor CSE machine.
  const initRawControl = control.getStack();
  const initRawStash   = stash.getStack();
  // Step 0: nothing evaluated yet, so the "current node" is the program node sitting
  // on top of control (matches non-conductor, which highlights the program's line 1).
  const initTop = initRawControl[initRawControl.length - 1];
  const initSnap: CseSnapshot = {
    stepIndex: 0,
    control: initRawControl.slice().reverse().map(item => serializeControlItem(item, source)),
    stash:   initRawStash.slice().reverse().map(v => serializeValue(v)),
    environments: serializeEnvChain(context.runtime.environments, initRawStash, initRawControl),
    currentLine: (initTop as any)?.loc?.start?.line,
  };
  snapshots.push(initSnap);

  // The js-slang generator is synchronous (function*), so for...of avoids the
  // microtask-per-step overhead that for-await-of would impose.
  const stream = generateCSEMachineStateStream(context, control, stash, -1, -1);
  let lastFingerprint = snapshotFingerprint(initSnap);

  for (const { stash: s, control: c, steps } of stream) {
    if (snapshots.length >= maxSnapshots) break;

    const rawControl = c.getStack();
    const rawStash = s.getStack();
    // The node most recently evaluated at this step. Mirrors non-conductor
    // updateInspector, which reads context.runtime.nodes[0] for the blue line.
    const currentNode = context.runtime.nodes[0] as any;
    const snap: CseSnapshot = {
      stepIndex: steps - 1,
      control: rawControl.slice().reverse().map(item => serializeControlItem(item, source)),
      stash:   rawStash.slice().reverse().map(v => serializeValue(v)),
      environments: serializeEnvChain(context.runtime.environments, rawStash, rawControl),
      currentLine: currentNode?.loc?.start?.line,
    };
    const fp = snapshotFingerprint(snap);
    if (fp !== lastFingerprint) {
      snapshots.push(snap);
      lastFingerprint = fp;
    }
  }

  return snapshots;
}

// ── Evaluator base ────────────────────────────────────────────────────────────

abstract class JSCseEvaluatorBase extends BasicEvaluator {
  protected abstract readonly chapter: Chapter;
  protected context!: Context;
  private readonly csePlugin: CseMachinePlugin;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    // Cast bridges the IPlugin type difference between this repo's (local/portal)
    // conductor and the one @sourceacademy/runner-cse-machine builds against. Once both
    // use the same published conductor, the cast can be removed.
    this.csePlugin = conductor.registerPlugin(
      CseMachinePlugin as never,
    ) as unknown as CseMachinePlugin;
  }

  protected initContext(): void {
    this.context = createContext(this.chapter);
  }

  async evaluateChunk(chunk: string): Promise<any> {
    if (!this.context) this.initContext();

    const preprocessResult = await preprocessFileImports(
      path => (path === '/code.js' ? Promise.resolve(chunk) : Promise.resolve(undefined)),
      '/code.js',
      this.context,
    );

    if (!preprocessResult.ok) {
      for (const error of this.context.errors) {
        this.conductor.sendOutput(`Error: ${error.explain()}`);
      }
      this.context.errors = [];
      return undefined;
    }

    const { program } = preprocessResult;
    seq.transform(program);

    const control = new Control(program);
    const stash = new Stash();
    this.context.runtime.control = control as any;
    this.context.runtime.stash = stash as any;

    try {
      const configRaw = await this.conductor.requestFile('/__cse_config__');
      const maxSnapshots: number = configRaw
        ? (JSON.parse(configRaw) as { stepLimit?: number }).stepLimit ?? 1000
        : 1000;
      const snapshots = await collectSnapshots(this.context, control, stash, chunk, maxSnapshots);
      this.csePlugin.sendSnapshots(snapshots);

      // Return the final stash value so BasicEvaluator.startEvaluator sends it as the result.
      // (BasicEvaluator calls conductor.sendResult(await evaluateChunk(...)) — do NOT call
      // sendResult here too or every program gets two result entries in the home tab.)
      const finalStash = stash.getStack();
      return finalStash[finalStash.length - 1];
    } catch (e) {
      const msg = this.context.errors.length > 0
        ? parseError(this.context.errors)
        : e instanceof Error ? e.message : String(e);
      this.conductor.sendOutput(`Error: ${msg}`);
      this.context.errors = [];
      return undefined;
    }
  }
}

// ── Concrete evaluators ───────────────────────────────────────────────────────

export class JSCseEvaluator3 extends JSCseEvaluatorBase {
  protected readonly chapter = Chapter.SOURCE_3;
  constructor(conductor: IRunnerPlugin) { super(conductor); this.initContext(); }
}

export class JSCseEvaluator4 extends JSCseEvaluatorBase {
  protected readonly chapter = Chapter.SOURCE_4;
  constructor(conductor: IRunnerPlugin) { super(conductor); this.initContext(); }
}
