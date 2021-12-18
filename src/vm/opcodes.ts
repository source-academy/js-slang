export enum OpCodes {
  NOP = 0,
  LDCI = 1, // integer
  LGCI = 2, // integer
  LDCF32 = 3, // 32-bit float
  LGCF32 = 4, // 32-bit float
  LDCF64 = 5, // 64-bit float
  LGCF64 = 6, // 64-bit float
  LDCB0 = 7,
  LDCB1 = 8,
  LGCB0 = 9,
  LGCB1 = 10,
  LGCU = 11,
  LGCN = 12,
  LGCS = 13, // string
  POPG = 14,
  POPB = 15,
  POPF = 16,
  ADDG = 17,
  ADDF = 18,
  SUBG = 19,
  SUBF = 20,
  MULG = 21,
  MULF = 22,
  DIVG = 23,
  DIVF = 24,
  MODG = 25,
  MODF = 26,
  NOTG = 27,
  NOTB = 28,
  LTG = 29,
  LTF = 30,
  GTG = 31,
  GTF = 32,
  LEG = 33,
  LEF = 34,
  GEG = 35,
  GEF = 36,
  EQG = 37,
  EQF = 38,
  EQB = 39,
  NEWC = 40, // Address of function
  NEWA = 41,
  LDLG = 42, // index in current env
  LDLF = 43, // index in current env
  LDLB = 44, // index in current env
  STLG = 45, // index in current env
  STLB = 46, // index in current env
  STLF = 47, // index in current env
  LDPG = 48, // index in env, index of parent relative to current env
  LDPF = 49, // index in env, index of parent relative to current env
  LDPB = 50, // index in env, index of parent relative to current env
  STPG = 51, // index in env, index of parent relative to current env
  STPB = 52, // index in env, index of parent relative to current env
  STPF = 53, // index in env, index of parent relative to current env
  LDAG = 54,
  LDAB = 55,
  LDAF = 56,
  STAG = 57,
  STAB = 58,
  STAF = 59,
  BRT = 60, // Offset
  BRF = 61, // Offset
  BR = 62, // Offset
  JMP = 63, // Address
  CALL = 64, // number of arguments
  CALLT = 65, // number of arguments
  CALLP = 66, // id of primitive function, number of arguments
  CALLTP = 67, // id of primitive function, number of arguments
  CALLV = 68, // id of vm-internal function, number of arguments
  CALLTV = 69, // id of vm-internal function, number of arguments
  RETG = 70,
  RETF = 71,
  RETB = 72,
  RETU = 73,
  RETN = 74,
  DUP = 75,
  NEWENV = 76, // number of locals in new environment
  POPENV = 77,
  NEWCP = 78,
  NEWCV = 79,
  NEGG = 80,
  NEGF = 81,
  NEQG = 82,
  NEQF = 83,
  NEQB = 84,

  // custom opcodes
  ARRAY_LEN = 1000,
  DISPLAY = 1001,
  DRAW_DATA = 1002,
  ERROR = 1003,
  IS_ARRAY = 1004,
  IS_BOOL = 1005,
  IS_FUNC = 1006,
  IS_NULL = 1007,
  IS_NUMBER = 1008,
  IS_STRING = 1009,
  IS_UNDEFINED = 1010,
  MATH_ABS = 1011,
  MATH_ACOS = 1012,
  MATH_ACOSH = 1013,
  MATH_ASIN = 1014,
  MATH_ASINH = 1015,
  MATH_ATAN = 1016,
  MATH_ATAN2 = 1017,
  MATH_ATANH = 1018,
  MATH_CBRT = 1019,
  MATH_CEIL = 1020,
  MATH_CLZ32 = 1021,
  MATH_COS = 1022,
  MATH_COSH = 1023,
  MATH_EXP = 1024,
  MATH_EXPM1 = 1025,
  MATH_FLOOR = 1026,
  MATH_FROUND = 1027,
  MATH_HYPOT = 1028,
  MATH_IMUL = 1029,
  MATH_LOG = 1030,
  MATH_LOG1P = 1031,
  MATH_LOG2 = 1032,
  MATH_LOG10 = 1033,
  MATH_MAX = 1034,
  MATH_MIN = 1035,
  MATH_POW = 1036,
  MATH_RANDOM = 1037,
  MATH_ROUND = 1038,
  MATH_SIGN = 1039,
  MATH_SIN = 1040,
  MATH_SINH = 1041,
  MATH_SQRT = 1042,
  MATH_TAN = 1043,
  MATH_TANH = 1044,
  MATH_TRUNC = 1045,
  PARSE_INT = 1046,
  RUNTIME = 1047,
  STREAM = 1048,
  STRINGIFY = 1049,
  PROMPT = 1050,
  DISPLAY_LIST = 1051,
  CHAR_AT = 1052,
  ARITY = 1053,

  // Source 3 Concurrenct Opcodes
  EXECUTE = 2000,
  TEST_AND_SET = 2001,
  CLEAR = 2002
}

export const OPCODE_MAX = 84

export function getInstructionSize(opcode: OpCodes): number {
  switch (opcode) {
    case OpCodes.LDLG:
    case OpCodes.LDLF:
    case OpCodes.LDLB:
    case OpCodes.STLG:
    case OpCodes.STLF:
    case OpCodes.STLB:
    case OpCodes.CALL:
    case OpCodes.CALLT:
    case OpCodes.NEWENV:
    case OpCodes.NEWCP:
    case OpCodes.NEWCV:
      return 2

    case OpCodes.LDPG:
    case OpCodes.LDPF:
    case OpCodes.LDPB:
    case OpCodes.STPG:
    case OpCodes.STPF:
    case OpCodes.STPB:
    case OpCodes.CALLP:
    case OpCodes.CALLTP:
    case OpCodes.CALLV:
    case OpCodes.CALLTV:
      return 3

    case OpCodes.LDCI:
    case OpCodes.LGCI:
    case OpCodes.LDCF32:
    case OpCodes.LGCF32:
    case OpCodes.LGCS:
    case OpCodes.NEWC:
    case OpCodes.BRF:
    case OpCodes.BRT:
    case OpCodes.BR:
    case OpCodes.JMP:
      return 5

    case OpCodes.LDCF64:
    case OpCodes.LGCF64:
      return 9

    default:
      return 1
  }
}

export default OpCodes
