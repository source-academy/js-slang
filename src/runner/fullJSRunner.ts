import type es from 'estree';
import type { RawSourceMap } from 'source-map';
import { RuntimeSourceError } from '../errors/base';
import { parse } from '../parser/parser';
import { getBuiltins, transpileToFullJS } from '../transpiler/transpiler';
import type { Context, NativeStorage } from '../types';
import * as create from '../utils/ast/astCreator';
import { Chapter } from '../langs';
import { toSourceError } from './errors';
import type { Runner } from './types';

function fullJSEval(code: string, nativeStorage: NativeStorage): any {
  if (nativeStorage.evaller) {
    return nativeStorage.evaller(code);
  } else {
    return eval(code);
  }
}

function preparePrelude(context: Context): es.Statement[] | undefined {
  if (context.prelude === null) {
    return [];
  }
  const prelude = context.prelude;
  context.prelude = null;
  const program = parse(prelude, context);
  if (program === null) {
    return undefined;
  }

  return program.body as es.Statement[];
}

const fullJSRunner: Runner = async (program, context, { isPrelude }) => {
  if (!context.nativeStorage.evaller) {
    let prelude: es.Statement[] | undefined;
    if (!isPrelude) {
      // prelude & builtins
      // only process builtins and preludes if it is a fresh eval context
      prelude = preparePrelude(context);
      if (prelude === undefined) {
        return { status: 'error', context };
      }
    } else {
      prelude = [];
    }

    // evaluate and create a separate block for preludes and builtins
    const { transpiled: preEvalCode } = transpileToFullJS(
      create.program([...getBuiltins(context.nativeStorage), ...prelude]),
      context,
      true,
    );

    fullJSEval(preEvalCode, context.nativeStorage);
  }

  let transpiled;
  let sourceMapJson: RawSourceMap | undefined;
  try {
    ({ transpiled, sourceMapJson } = transpileToFullJS(
      program,
      context,
      context.chapter === Chapter.FULL_JS,
    ));
    console.log(transpiled);
    return {
      status: 'finished',
      context,
      value: fullJSEval(transpiled, context.nativeStorage),
    };
  } catch (error) {
    console.error(error);
    context.errors.push(
      error instanceof RuntimeSourceError ? error : await toSourceError(error, sourceMapJson),
    );
    return { status: 'error', context };
  }
};

export default fullJSRunner;
