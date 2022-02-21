import Buffer from '../utils/buffer'
import OpCodes, { getInstructionSize, OPCODE_MAX } from './opcodes'
import { Instruction, Program, SVMFunction } from './svml-compiler'

const SVM_MAGIC = 0x5005acad
const MAJOR_VER = 0
const MINOR_VER = 0

let UTF8_ENCODER: TextEncoder | undefined

/**
 * A "hole" in an assembled function.
 */
interface Hole {
  offset: number
  referent: ['string', string] | ['function', number]
}

/**
 * Intermediate (partially serialised) function.
 */
interface ImFunction {
  binary: Uint8Array
  holes: Hole[]
  finalOffset: number | null
}

function writeHeader(b: Buffer, entrypoint: number, constantCount: number) {
  b.cursor = 0
  b.putU(32, SVM_MAGIC)
  b.putU(16, MAJOR_VER)
  b.putU(16, MINOR_VER)
  b.putU(32, entrypoint)
  b.putU(32, constantCount)
}

function writeStringConstant(b: Buffer, s: string) {
  if (UTF8_ENCODER === undefined) {
    UTF8_ENCODER = new TextEncoder()
  }
  const sBytes = UTF8_ENCODER.encode(s)

  b.align(4)
  b.putU(16, 1)
  b.putU(32, sBytes.byteLength + 1)
  b.putA(sBytes)
  b.putU(8, 0)
}

function serialiseFunction(f: SVMFunction): ImFunction {
  const [stackSize, envSize, numArgs, code] = f
  const holes: Hole[] = []
  const b = new Buffer()

  b.putU(8, stackSize)
  b.putU(8, envSize)
  b.putU(8, numArgs)
  b.putU(8, 0) // padding

  const instrOffsets = code
    .map(i => getInstructionSize(i[0]))
    .reduce((ss, s) => (ss.push(ss[ss.length - 1] + s), ss), [0])

  for (const [instr, index] of code.map((i1, i2) => [i1, i2] as [Instruction, number])) {
    if (instr[0] < 0 || instr[0] > OPCODE_MAX) {
      throw new Error(`Invalid opcode ${instr[0].toString()}`)
    }
    const opcode: OpCodes = instr[0]
    b.putU(8, opcode)
    switch (opcode) {
      case OpCodes.LDCI:
      case OpCodes.LGCI:
        if (!Number.isInteger(instr[1] as number)) {
          throw new Error(`Non-integral operand to LDCI/LDGI: ${instr[1]} (this is a compiler bug)`)
        }
        b.putI(32, instr[1] as number)
        break
      case OpCodes.LDCF32:
      case OpCodes.LGCF32:
        b.putF(32, instr[1] as number)
        break
      case OpCodes.LDCF64:
      case OpCodes.LGCF64:
        b.putF(64, instr[1] as number)
        break
      case OpCodes.LGCS:
        holes.push({
          offset: b.cursor,
          referent: ['string', instr[1] as string]
        })
        b.putU(32, 0)
        break
      case OpCodes.NEWC:
        holes.push({
          offset: b.cursor,
          referent: ['function', instr[1]![0]]
        })
        b.putU(32, 0)
        break
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
        b.putU(8, instr[1] as number)
        break
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
        b.putU(8, instr[1] as number)
        b.putU(8, instr[2] as number)
        break
      case OpCodes.BRF:
      case OpCodes.BRT:
      case OpCodes.BR:
        const offset = instrOffsets[index + (instr[1] as number)] - instrOffsets[index + 1]
        b.putI(32, offset)
        break
      case OpCodes.JMP:
        throw new Error('JMP assembling not implemented')
    }
  }

  const binary = b.asArray()
  if (binary.byteLength - 4 !== instrOffsets[instrOffsets.length - 1]) {
    throw new Error(
      `Assembler bug: calculated function length ${
        instrOffsets[instrOffsets.length - 1]
      } is different from actual length ${binary.byteLength - 4}`
    )
  }

  return {
    binary: b.asArray(),
    holes,
    finalOffset: null
  }
}

export function assemble(p: Program): Uint8Array {
  const [entrypointIndex, jsonFns] = p

  // serialise all the functions
  const imFns = jsonFns.map(fn => serialiseFunction(fn))

  // collect all string constants
  const uniqueStrings = [
    ...new Set(
      ([] as string[]).concat(
        ...imFns.map(fn =>
          fn.holes
            .filter(hole => hole.referent[0] === 'string')
            .map(hole => hole.referent[1] as string)
        )
      )
    )
  ]

  const bin = new Buffer()
  // skip header for now
  bin.cursor = 0x10

  // write all the strings, and store their positions
  const stringMap: Map<string, number> = new Map()
  for (const str of uniqueStrings) {
    bin.align(4)
    stringMap.set(str, bin.cursor)
    writeStringConstant(bin, str)
  }

  // layout the functions, but don't actually write them yet
  const fnStartOffset = bin.cursor
  for (const fn of imFns) {
    bin.align(4)
    fn.finalOffset = bin.cursor
    bin.cursor += fn.binary.byteLength
  }

  // now fill in the holes
  for (const fn of imFns) {
    const view = new DataView(fn.binary.buffer)
    for (const hole of fn.holes) {
      let offset
      if (hole.referent[0] === 'string') {
        offset = stringMap.get(hole.referent[1])
      } else {
        offset = imFns[hole.referent[1]].finalOffset
      }
      if (!offset) {
        throw new Error(`Assembler bug: missing string/function: ${JSON.stringify(hole)}`)
      }
      view.setUint32(hole.offset, offset, true)
    }
  }

  // now we write the functions
  bin.cursor = fnStartOffset
  for (const fn of imFns) {
    bin.align(4)
    if (bin.cursor !== fn.finalOffset) {
      throw new Error('Assembler bug: function offset changed')
    }
    bin.putA(fn.binary)
  }

  bin.cursor = 0
  writeHeader(bin, imFns[entrypointIndex].finalOffset!, uniqueStrings.length)

  return bin.asArray()
}
