import { OpCodes } from './opcodes'
import { Program } from './svml-compiler'

const OPCODES_STR = {
  [OpCodes.NOP]: 'NOP   ',
  [OpCodes.LDCI]: 'LDCI  ',
  [OpCodes.LGCI]: 'LGCI  ',
  [OpCodes.LDCF32]: 'LDCF32',
  [OpCodes.LGCF32]: 'LGCF32',
  [OpCodes.LDCF64]: 'LDCF64',
  [OpCodes.LGCF64]: 'LGCF64',
  [OpCodes.LDCB0]: 'LDCB0 ',
  [OpCodes.LDCB1]: 'LDCB1 ',
  [OpCodes.LGCB0]: 'LGCB0 ',
  [OpCodes.LGCB1]: 'LGCB1 ',
  [OpCodes.LGCU]: 'LGCU  ',
  [OpCodes.LGCN]: 'LGCN  ',
  [OpCodes.LGCS]: 'LGCS  ',
  [OpCodes.POPG]: 'POPG  ',
  [OpCodes.POPB]: 'POPB  ',
  [OpCodes.POPF]: 'POPF  ',
  [OpCodes.ADDG]: 'ADDG  ',
  [OpCodes.ADDF]: 'ADDF  ',
  [OpCodes.SUBG]: 'SUBG  ',
  [OpCodes.SUBF]: 'SUBF  ',
  [OpCodes.MULG]: 'MULG  ',
  [OpCodes.MULF]: 'MULF  ',
  [OpCodes.DIVG]: 'DIVG  ',
  [OpCodes.DIVF]: 'DIVF  ',
  [OpCodes.MODG]: 'MODG  ',
  [OpCodes.MODF]: 'MODF  ',
  [OpCodes.NEGG]: 'NEGG  ',
  [OpCodes.NEGF]: 'NEGF  ',
  [OpCodes.NOTG]: 'NOTG  ',
  [OpCodes.NOTB]: 'NOTB  ',
  [OpCodes.LTG]: 'LTG   ',
  [OpCodes.LTF]: 'LTF   ',
  [OpCodes.GTG]: 'GTG   ',
  [OpCodes.GTF]: 'GTF   ',
  [OpCodes.LEG]: 'LEG   ',
  [OpCodes.LEF]: 'LEF   ',
  [OpCodes.GEG]: 'GEG   ',
  [OpCodes.GEF]: 'GEF   ',
  [OpCodes.EQG]: 'EQG   ',
  [OpCodes.EQF]: 'EQF   ',
  [OpCodes.EQB]: 'EQB   ',
  [OpCodes.NEQG]: 'NEQG  ',
  [OpCodes.NEQF]: 'NEQF  ',
  [OpCodes.NEQB]: 'NEQB  ',
  [OpCodes.NEWC]: 'NEWC  ',
  [OpCodes.NEWA]: 'NEWA  ',
  [OpCodes.LDLG]: 'LDLG  ',
  [OpCodes.LDLF]: 'LDLF  ',
  [OpCodes.LDLB]: 'LDLB  ',
  [OpCodes.STLG]: 'STLG  ',
  [OpCodes.STLB]: 'STLB  ',
  [OpCodes.STLF]: 'STLF  ',
  [OpCodes.LDPG]: 'LDPG  ',
  [OpCodes.LDPF]: 'LDPF  ',
  [OpCodes.LDPB]: 'LDPB  ',
  [OpCodes.STPG]: 'STPG  ',
  [OpCodes.STPB]: 'STPB  ',
  [OpCodes.STPF]: 'STPF  ',
  [OpCodes.LDAG]: 'LDAG  ',
  [OpCodes.LDAB]: 'LDAB  ',
  [OpCodes.LDAF]: 'LDAF  ',
  [OpCodes.STAG]: 'STAG  ',
  [OpCodes.STAB]: 'STAB  ',
  [OpCodes.STAF]: 'STAF  ',
  [OpCodes.BRT]: 'BRT   ',
  [OpCodes.BRF]: 'BRF   ',
  [OpCodes.BR]: 'BR    ',
  [OpCodes.JMP]: 'JMP   ',
  [OpCodes.CALL]: 'CALL  ',
  [OpCodes.CALLT]: 'CALLT ',
  [OpCodes.CALLP]: 'CALLP ',
  [OpCodes.CALLTP]: 'CALLTP',
  [OpCodes.CALLV]: 'CALLV ',
  [OpCodes.CALLTV]: 'CALLTV',
  [OpCodes.RETG]: 'RETG  ',
  [OpCodes.RETF]: 'RETF  ',
  [OpCodes.RETB]: 'RETB  ',
  [OpCodes.RETU]: 'RETU  ',
  [OpCodes.RETN]: 'RETN  ',
  [OpCodes.DUP]: 'DUP   ',
  [OpCodes.NEWENV]: 'NEWENV',
  [OpCodes.POPENV]: 'POPENV',
  [OpCodes.NEWCP]: 'NEWCP ',
  [OpCodes.NEWCV]: 'NEWCV ',
  [OpCodes.NEGG]: 'NEGG  ',
  [OpCodes.NEGF]: 'NEGF  ',
  [OpCodes.NEQG]: 'NEQG  ',
  [OpCodes.NEQF]: 'NEQF  ',
  [OpCodes.NEQB]: 'NEQB  ',

  // custom opcodes
  [OpCodes.ARRAY_LEN]: 'ARR_LEN',
  [OpCodes.DISPLAY]: 'DISPLAY',
  [OpCodes.DRAW_DATA]: 'DRAW_DATA',
  [OpCodes.ERROR]: 'ERROR',
  [OpCodes.IS_ARRAY]: 'IS_ARRAY',
  [OpCodes.IS_BOOL]: 'IS_BOOL',
  [OpCodes.IS_FUNC]: 'IS_FUNC',
  [OpCodes.IS_NULL]: 'IS_NULL',
  [OpCodes.IS_NUMBER]: 'IS_NUM',
  [OpCodes.IS_STRING]: 'IS_STR',
  [OpCodes.IS_UNDEFINED]: 'IS_UNDEF',
  [OpCodes.MATH_ABS]: 'MATH_ABS',
  [OpCodes.MATH_ACOS]: 'MATH_ACOS',
  [OpCodes.MATH_ACOSH]: 'MATH_ACOSH',
  [OpCodes.MATH_ASINH]: 'MATH_ASINH',
  [OpCodes.MATH_ATAN]: 'MATH_ATAN',
  [OpCodes.MATH_ATAN2]: 'MATH_ATAN2',
  [OpCodes.MATH_ATANH]: 'MATH_ATANH',
  [OpCodes.MATH_CBRT]: 'MATH_CBRT',
  [OpCodes.MATH_CEIL]: 'MATH_CEIL',
  [OpCodes.MATH_CLZ32]: 'MATH_CLZ32',
  [OpCodes.MATH_COS]: 'MATH_COS',
  [OpCodes.MATH_COSH]: 'MATH_COSH',
  [OpCodes.MATH_EXP]: 'MATH_EXP',
  [OpCodes.MATH_EXPM1]: 'MATH_EXPM1',
  [OpCodes.MATH_FLOOR]: 'MATH_FLOOR',
  [OpCodes.MATH_FROUND]: 'MATH_FROUND',
  [OpCodes.MATH_HYPOT]: 'MATH_HYPOT',
  [OpCodes.MATH_IMUL]: 'MATH_IMUL',
  [OpCodes.MATH_LOG]: 'MATH_LOG',
  [OpCodes.MATH_LOG1P]: 'MATH_LOG1P',
  [OpCodes.MATH_LOG2]: 'MATH_LOG2',
  [OpCodes.MATH_LOG10]: 'MATH_LOG10',
  [OpCodes.MATH_MAX]: 'MATH_MAX',
  [OpCodes.MATH_MIN]: 'MATH_MIN',
  [OpCodes.MATH_POW]: 'MATH_POW',
  [OpCodes.MATH_RANDOM]: 'MATH_RANDOM',
  [OpCodes.MATH_ROUND]: 'MATH_ROUND',
  [OpCodes.MATH_SIGN]: 'MATH_SIGN',
  [OpCodes.MATH_SIN]: 'MATH_SIN',
  [OpCodes.MATH_SINH]: 'MATH_SINH',
  [OpCodes.MATH_SQRT]: 'MATH_SQRT',
  [OpCodes.MATH_TAN]: 'MATH_TAN',
  [OpCodes.MATH_TANH]: 'MATH_TANH',
  [OpCodes.MATH_TRUNC]: 'MATH_TRUNC',
  [OpCodes.PARSE_INT]: 'PARSE_INT',
  [OpCodes.RUNTIME]: 'RUNTIME',
  [OpCodes.STREAM]: 'STREAM',
  [OpCodes.STRINGIFY]: 'STRINGIFY',
  [OpCodes.PROMPT]: 'PROMPT',
  [OpCodes.DISPLAY_LIST]: 'DISPLAY_LIST',
  [OpCodes.CHAR_AT]: 'CHAR_AT',
  [OpCodes.ARITY]: 'ARITY',

  // Concurrency Opcodes
  [OpCodes.EXECUTE]: 'EXEC  ',
  [OpCodes.TEST_AND_SET]: 'T&S   ',
  [OpCodes.CLEAR]: 'CLEAR '
}

// get name of opcode for debugging
export function getName(op: number) {
  return OPCODES_STR[op] // need to add guard in case op does not exist
}

// pretty-print the program
export function stringifyProgram(P: Program) {
  const functions = P[1]
  let programStr = ''
  programStr += 'Entry function: ' + P[0] + '\n'
  for (let i = 0; i < functions.length; i++) {
    const f = functions[i]
    let s =
      '#' + i + ':\nStack Size: ' + f[0] + '\nEnv Size: ' + f[1] + '\nNum Args: ' + f[2] + '\n'
    for (let j = 0; j < f[3].length; j++) {
      s += j
      const ins = f[3][j]
      s += ': ' + getName(ins[0])
      for (let k = 1; k < ins.length; k++) {
        s += ' ' + ins[k]
      }
      s += '\n'
    }
    programStr += s + '\n'
  }
  return programStr
}
