#!/usr/bin/env node
import fs from 'fs/promises';
import pathlib from 'path';
import { Command } from '@commander-js/extra-typings';
import { generate } from 'astring';

import { createContext, parseError } from '../index';
import { Chapter, Variant } from '../langs';
import defaultBundler from '../modules/preprocessor/bundler';
import parseProgramsAndConstructImportGraph from '../modules/preprocessor/linker';
import { transpile } from '../transpiler/transpiler';
import {
  assertLanguageCombo,
  chapterParser,
  getChapterOption,
  getLanguageOption,
  getVariantOption,
  nodeFileGetter,
} from './utils';

export const getTranspilerCommand = () =>
  new Command('transpiler')
    .addOption(getVariantOption(Variant.DEFAULT, [Variant.DEFAULT, Variant.NATIVE]))
    .addOption(getChapterOption(Chapter.SOURCE_4, chapterParser))
    .addOption(getLanguageOption())
    .option(
      '-p, --pretranspile',
      "only pretranspile (e.g. GPU -> Source) and don't perform Source -> JS transpilation",
    )
    .option('-o, --out <outFile>', 'Specify a file to write to')
    .argument('<filename>')
    .action(async (fileName, opts) => {
      assertLanguageCombo(opts);

      const context = createContext(opts.chapter, opts.variant, opts.languageOptions);
      const entrypointFilePath = pathlib.resolve(fileName);

      const linkerResult = await parseProgramsAndConstructImportGraph(
        nodeFileGetter,
        entrypointFilePath,
        context,
        {},
        true,
      );

      if (!linkerResult.ok) {
        process.stderr.write(parseError(context.errors, linkerResult.verboseErrors));
        process.exit(1);
      }

      const { programs, topoOrder } = linkerResult;
      const bundledProgram = defaultBundler(programs, entrypointFilePath, topoOrder, context);

      try {
        const transpiled = opts.pretranspile
          ? generate(bundledProgram)
          : transpile(bundledProgram, context, false).transpiled;

        if (opts.out) {
          await fs.writeFile(opts.out, transpiled);
          console.log(`Code written to ${opts.out}`);
        } else {
          process.stdout.write(transpiled);
        }
      } catch (error) {
        process.stderr.write(parseError([error], linkerResult.verboseErrors));
        process.exit(1);
      }
    });
