import * as Inst from '../compiler/instructions'
import * as Token from '../tokens/tokens'
import { HeapBuffer } from '../heap/heap'
import { HeapVal, ValType } from '../heap/heapVals'
import { UnassignedVarError } from '../heap/errors'
import { GoRoutine } from './goroutine'
import { EmptyOsError, EmptyRtsError } from './errors'
import { binop_microcode, unop_microcode } from './microcode'
import { generateBuiltins } from './builtins'

const TIME_QUANTUM = 50 // switch goroutines after 50 lines executed

export class GoVirtualMachine {
  memory: HeapBuffer
  instrs: Inst.Instruction[]
  debugMode: boolean

  constructor(instrs: Inst.Instruction[], debugMode?: boolean) {
    this.instrs = instrs
    this.memory = new HeapBuffer()
    this.debugMode = debugMode !== undefined && debugMode
  }

  run() {
    const mem = this.memory
    let routineId = 1
    let globalEnv = mem.heap_allocate_Environment(0)
    // load literal frame
    globalEnv = mem.heap_Environment_extend(mem.allocateLiteralValues(), globalEnv)
    // load builtin frame
    globalEnv = mem.heap_Environment_extend(mem.allocate_builtin_frame(), globalEnv)
    const rootRoutine = new GoRoutine(globalEnv, routineId++)
    mem.grQueue.push(rootRoutine)

    const builtin_func = generateBuiltins(mem)

    while (!mem.grQueue.isEmpty()) {
      const currRoutine = mem.grQueue.peek()
      if (currRoutine === undefined) {
        break
      }
      if (this.debugMode) {
        console.log('Running routine %d', currRoutine.id)
      }
      let step = 0
      let inst: Inst.Instruction
      const OS = currRoutine.OS
      const RTS = currRoutine.RTS
      currRoutine.blocked = false
      while (step < TIME_QUANTUM && !currRoutine.blocked && !currRoutine.terminate) {
        if (this.debugMode) {
          console.log('Executing instruction %d', currRoutine.PC)
        }
        inst = this.instrs[currRoutine.PC++]
        switch (inst.getType()) {
          case Inst.InstType.DONE:
            currRoutine.terminate = true
            break
          case Inst.InstType.LDC:
            const basicInst = inst as Inst.BasicLitInstruction
            switch (basicInst.tokenType) {
              case Token.token.STRING:
                OS.push(mem.valToAddr(new HeapVal(basicInst.value as string, ValType.String)))
                break
              case Token.token.CHAR:
                OS.push(
                  mem.valToAddr(
                    new HeapVal((basicInst.value as string).charCodeAt(1), ValType.Char)
                  )
                )
                break
              case Token.token.INT:
                OS.push(
                  mem.valToAddr(new HeapVal(Number(basicInst.value as string), ValType.Int32))
                )
                break
            }
            break
          case Inst.InstType.UNOP:
            const unxAddr = OS.pop()
            if (unxAddr === undefined) {
              throw new EmptyOsError()
            }
            const unop = unop_microcode.get((inst as Inst.UnOpInstruction).op)
            if (unop !== undefined) {
              const res = unop(mem.addrToVal(unxAddr))
              OS.push(mem.valToAddr(res))
            } else {
              throw new Error('Unary operation not found!')
            }
            break
          case Inst.InstType.BINOP:
            const binyAddr = OS.pop()
            if (binyAddr === undefined) {
              throw new EmptyOsError()
            }
            const binxAddr = OS.pop()
            if (binxAddr === undefined) {
              throw new EmptyOsError()
            }
            const binop = binop_microcode.get((inst as Inst.BinOpInstruction).op)
            if (binop !== undefined) {
              const res = binop(mem.addrToVal(binxAddr), mem.addrToVal(binyAddr))
              OS.push(mem.valToAddr(res))
            } else {
              throw new Error('Binary operation not found!')
            }
            break
          case Inst.InstType.LD:
            const item = mem.heap_get_Environment_value(
              currRoutine.ENV,
              (inst as Inst.IdentInstruction).pos
            )
            if (mem.isUnassigned(item)) {
              throw new UnassignedVarError()
            }
            OS.push(item)
            break
          case Inst.InstType.POP:
            OS.pop()
            break
          case Inst.InstType.JOF:
            const jofXAddr = OS.pop()
            if (jofXAddr === undefined) {
              throw new EmptyOsError()
            }
            if (!(mem.addrToVal(jofXAddr).val as boolean)) {
              currRoutine.PC = (inst as Inst.JumpOnFalseInstruction).dest
            }
            break
          case Inst.InstType.GOTO:
            currRoutine.PC = (inst as Inst.GotoInstruction).dest
            break
          case Inst.InstType.ITER_END:
            break
          case Inst.InstType.FOR_END:
            break
          case Inst.InstType.CALL:
            const callArgs: number[] = []
            const callInst = inst as Inst.CallInstruction
            for (let i = callInst.arity - 1; i >= 0; --i) {
              const arg = OS.pop()
              if (arg === undefined) {
                throw new EmptyOsError()
              }
              callArgs.push(arg)
            }
            const funcAddr = OS.pop()
            if (funcAddr === undefined) {
              throw new EmptyOsError()
            }
            if (mem.isBuiltin(funcAddr)) {
              const builtinId = mem.heap_get_builtin_id(funcAddr)
              const builtinCallArgs: any[] = Array(
                callArgs.forEach(argAddr => mem.addrToVal(argAddr))
              ).reverse()
              const builtinRes = builtin_func[builtinId].func(...builtinCallArgs)
              if (builtinRes.type !== ValType.Undefined) {
                // if ValType undefined, builtin function does not produce any values
                OS.push(mem.valToAddr(builtinRes))
              }
            } else {
              const frameSize = mem.heap_get_Closure_arity(funcAddr)
              const frameAddr = mem.heap_allocate_Frame(frameSize)
              for (let i = callInst.arity - 1; i >= 0; --i) {
                // need to reverse order since callArgs was filled by popping the operand stack
                mem.heap_set_child(frameAddr, callInst.arity - 1 - i, callArgs[i])
              }
              const newCallEnv = mem.heap_Environment_extend(
                frameAddr,
                mem.heap_get_Closure_env(funcAddr)
              )
              const newPC = mem.heap_get_Closure_pc(funcAddr)
              RTS.push(mem.heap_allocate_Callframe(currRoutine.PC, currRoutine.ENV))
              currRoutine.ENV = newCallEnv
              currRoutine.PC = newPC
            }
            break
          case Inst.InstType.ENTER_SCOPE:
            const blockFrame = mem.heap_allocate_Blockframe(currRoutine.ENV)
            RTS.push(blockFrame)
            const scopeFrame = mem.heap_allocate_Frame(
              (inst as Inst.EnterScopeInstruction).varCount
            )
            currRoutine.ENV = mem.heap_Environment_extend(scopeFrame, currRoutine.ENV)
            break
          case Inst.InstType.EXIT_SCOPE:
            const prevEnvAddr = RTS.pop()
            if (prevEnvAddr === undefined) {
              throw new EmptyRtsError()
            }
            currRoutine.ENV = mem.heap_get_Blockframe_environment(prevEnvAddr)
            break
          case Inst.InstType.ASSIGN:
            const assignVal = OS.pop()
            if (assignVal === undefined) {
              throw new EmptyOsError()
            }
            mem.heap_set_Environment_value(
              currRoutine.ENV,
              (inst as Inst.AssignInstruction).pos,
              assignVal
            )
            break
          case Inst.InstType.LDF:
            const loadFuncInst = inst as Inst.LoadFunctionInstruction
            const closureAddr = mem.heap_allocate_Closure(
              loadFuncInst.arity,
              loadFuncInst.addr,
              currRoutine.ENV
            )
            OS.push(closureAddr)
            break
          case Inst.InstType.BREAK:
            while (
              currRoutine.PC < this.instrs.length &&
              this.instrs[currRoutine.PC].getType() !== Inst.InstType.FOR_END
            ) {
              currRoutine.PC++
            }
            currRoutine.PC++
            break
          case Inst.InstType.CONT:
            while (
              currRoutine.PC < this.instrs.length &&
              this.instrs[currRoutine.PC].getType() !== Inst.InstType.ITER_END
            ) {
              currRoutine.PC++
            }
            currRoutine.PC++
            break
          case Inst.InstType.RESET:
            const top_frame = RTS.pop()
            if (top_frame === undefined) {
              throw new EmptyRtsError()
            }
            if (mem.isCallframe(top_frame)) {
              currRoutine.PC = mem.heap_get_Callframe_pc(top_frame)
              currRoutine.ENV = mem.heap_get_Callframe_env(top_frame)
            } else {
              currRoutine.PC--
            }
            break
          case Inst.InstType.GO_DEST:
            currRoutine.terminate = true
            break
          case Inst.InstType.GO:
            const newGrOs: number[] = []
            // push args and function to call
            for (let i = 0; i < (inst as Inst.GoInstruction).arity + 1; ++i) {
              const addr = OS.pop()
              if (addr === undefined) {
                throw new EmptyOsError()
              }
              newGrOs.push(addr)
            }
            const newRoutine = new GoRoutine(globalEnv, routineId++, currRoutine.PC + 1)
            newRoutine.OS = newGrOs.reverse()
            mem.grQueue.push(newRoutine)
            break
        }
        ++step
      }
      mem.grQueue.pop()
      if (!currRoutine.terminate) {
        mem.grQueue.push(currRoutine)
      }
    }
  }
}
