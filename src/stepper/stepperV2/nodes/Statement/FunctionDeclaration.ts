import { Comment, FunctionDeclaration, SourceLocation } from "estree"
import { StepperBaseNode } from "../../interface"
import { StepperIdentifier } from "../Expression/Identifier"
import { StepperBlockStatement } from "./BlockStatement"
import { StepperExpression, StepperPattern, undefinedNode } from ".."
import { convert } from "../../generator"
import { redex, SubstitutionScope } from "../.."
import { StepperArrowFunctionExpression } from "../Expression/ArrowFunctionExpression"
import { getFreshName } from "../../utils"

export class StepperFunctionDeclaration implements FunctionDeclaration, StepperBaseNode {
    type: 'FunctionDeclaration'
    id: StepperIdentifier
    body: StepperBlockStatement
    params: StepperPattern[]
    generator?: boolean | undefined
    async?: boolean | undefined
    leadingComments?: Comment[] | undefined
    trailingComments?: Comment[] | undefined
    loc?: SourceLocation | null | undefined
    range?: [number, number] | undefined
  
    constructor(
      id: StepperIdentifier,
      body: StepperBlockStatement,
      params: StepperPattern[],
      generator?: boolean | undefined,
      async?: boolean | undefined,
      leadingComments?: Comment[] | undefined,
      trailingComments?: Comment[] | undefined,
      loc?: SourceLocation | null | undefined,
      range?: [number, number] | undefined
    ) {
      this.type = 'FunctionDeclaration'
      this.id = id
      this.body = body
      this.params = params
      this.generator = generator
      this.async = async
      this.leadingComments = leadingComments
      this.trailingComments = trailingComments
      this.loc = loc
      this.range = range
    }
    
  
    static create(node: FunctionDeclaration) {
      return new StepperFunctionDeclaration(
        convert(node.id) as StepperIdentifier,
        convert(node.body) as StepperBlockStatement,
        node.params.map(param => convert(param) as StepperPattern),
        node.generator,
        node.async,
        node.leadingComments,
        node.trailingComments,
        node.loc,
        node.range
      )
    }
  
    isContractible(): boolean {
      return true
    }
  
    isOneStepPossible(): boolean {
      return true
    }
  
    contract(): typeof undefinedNode {
      redex.preRedex = [this]
      redex.postRedex = []
      

      const arrowFunction = new StepperArrowFunctionExpression(
        this.params,
        this.body as unknown as StepperExpression,
        this.id.name,
        false,
        this.async,
        this.generator
      );
      
      if (this.id && arrowFunction.type === 'ArrowFunctionExpression') {
        arrowFunction.setGivenName?.(this.id.name);
      }
      
      SubstitutionScope.substitute(this.id, arrowFunction);
      
      return undefinedNode;
    }
  
    contractEmpty() {
      redex.preRedex = [this]
      redex.postRedex = []
    }
  
    oneStep(): typeof undefinedNode {
      return this.contract()
    }

    scanAllDeclarationNames(): string[] {
       const paramNames = this.params.map(param => param.name);
       const bodyDeclarations = this.body.body
         .filter(stmt => stmt.type === 'VariableDeclaration')
         .flatMap(decl => (decl as any).declarations.map((d: any) => d.id.name));
       
       return [...paramNames, ...bodyDeclarations];
    }
  
    substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
        const valueFreeNames = value.freeNames()
        const scopeNames = this.scanAllDeclarationNames()
        const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name))
    
        var currentFunction: StepperFunctionDeclaration = this;
        for (var index in repeatedNames) {
          const name = repeatedNames[index]
          currentFunction = currentFunction.rename(name, getFreshName(name)) as StepperFunctionDeclaration
        }
    
        if (currentFunction.scanAllDeclarationNames().includes(id.name)) {
          return currentFunction;
        }
    
        return new StepperFunctionDeclaration(
            this.id,
            currentFunction.body.substitute(id, value) as unknown as StepperBlockStatement,
            currentFunction.params,
        )
    }
  
    freeNames(): string[] {
        const paramNames = this.params
          .filter(param => param.type === 'Identifier')
          .map(param => param.name)
        return this.body.freeNames().filter(name => !paramNames.includes(name))
      }
  
      rename(before: string, after: string): StepperFunctionDeclaration {
        return new StepperFunctionDeclaration(
          this.id,
          this.body.rename(before, after) as unknown as StepperBlockStatement,
          this.params.map(param => param.rename(before, after)),
        )
      }
  }