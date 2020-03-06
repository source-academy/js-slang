import { OpCodes, Program } from './svml-compiler'
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
  [OpCodes.NEWENV]: 'NEWENV   ',
  [OpCodes.POPENV]: 'POPENV   '
}

// get name of opcode for debugging
export function getName(op: number) {
  return OPCODES_STR[op] // need to add guard in case op does not exist
}

// pretty-print the program
export function printProgram(P: Program) {
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
  console.log('', programStr)
}
