# Stepper Documentation (Draft)
- [Stepper Documentation (Draft)](#stepper-documentation-draft)
  - [Key changes](#key-changes)
  - [Quickstart](#quickstart)
  - [Implementation Details](#implementation-details)
    - [Entry point](#entry-point)
    - [Reduction](#reduction)
    - [Substitution](#substitution)
  - [Stepper ASTs](#stepper-asts)
    - [`UndefinedNode`](#undefinednode)
    - [`StepperProgram`](#stepperprogram)
      - [Reduction](#reduction-1)
    - [`VariableDeclaration`](#variabledeclaration)
      - [Reduction](#reduction-2)

## Key changes
- Rewritten the code to be more cohesive and readable.
- Better visualisation of recursion using lambda calculus concepts such as µ-terms. 

## Quickstart
First of all, make sure that you have already installed `js-slang` using `yarn`. There are many possible ways that you can work and test the code. One of my personal solution is using `yarn test`. You can edit the file from `../__test__/StepperV2.ts` and run it with the following command:
```bash
yarn test -- stepperV2.ts --silence=false  
```
Note that the flag `--silence=false` is set in order to see the output from `console.log`. 

## Implementation Details
Starting to work from raw estree is quite tricky, as it prevents us from using OOP principles directly. Therefore, we decided to create classes based on the original estree while implementing the `StepperBaseNode` interface. Note that this interface is subjected to change when adding more features to the stepper.
```typescript
// interface.ts
export interface StepperBaseNode {
  type: string
  isContractible(): boolean
  isOneStepPossible(): boolean
  contract(): StepperBaseNode
  oneStep(): StepperBaseNode
  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode
}
```
### Entry point
The starting point of our stepper is at `steppers.ts` with the function `getSteps`. This function is responsible for triggering reduction until it cannot be proceed. The result from our evaluation is then stored in array `steps`. Here is the shorten version of `getSteps`.

```typescript
export function getSteps(node: StepperBaseNode) {
  const steps = []
  function evaluate(node) {
    const isOneStepPossible = node.isOneStepPossible()
    if (isOneStepPossible) {
      const oldNode = node
      const newNode = node.oneStep() // entry point
      {... read global state redex and add them to steps array}
      return evaluate(newNode) 
    } else {
      return node
    }
  }
  evaluate(node)
  return steps
}

```

In order to keep track of the node that is reduced (i.e., the node highlighted in orange and green in the current SICP stepper), we use the global state redex to track all nodes that should be highlighted. This state is then updated dynamically during the contraction process.

```typescript
export let redex: { preRedex: StepperBaseNode[]; postRedex: StepperBaseNode[] } = {
  preRedex: [],
  postRedex: []
}
// How to use global state
redex.preRedex = [node]
const ret = someSortOfReduction(node)
redex.postRedex = [ret]
```
### Reduction
The main entry point of our stepper is `oneStep()`. It is where our stepper start crawling down the tree and find the node that is ready to be `contract()`. Here is a quick example.
```typescript
1 + 2 * 3 // (+ 1 (* 2 3))
```
The binary expression `(+ 1 (* 2 3))` should not be contracted since its inner node `(* 2 3)` can be contracted to `6`, before contracting the outer expression. The methods `isContractible` and `isOneStepPossible` help maneuver the logic of where to contract.
### Substitution
At this stage, substitution can be triggered by `VariableDeclaration`. To track the entry point for substitution, we use global state `SubstitutedScope` to track the substitution scope. Here is an example:
```typescript
// method in class StepperProgram
SubstitutionScope.set(this.body.slice(2)); // set the second statement onwards as a scope for substitution
const secondStatementOneStep = this.body[1].oneStep(); // trigger substitution if init field has been reduced
const afterSubstitutedScope = SubstitutionScope.get(); // get the substitution scope back
SubstitutionScope.reset();
// somewhere in this.body[1] node
SubstitutionScope.substitute(identifier, value) // trigger substitution on SubstitutionScope
```

## Stepper ASTs
### `UndefinedNode`
- Global node, literal, representing undefined

### `StepperProgram`
#### Reduction
- If `node.body.length === 0`, the program is reduced to `StepperUndefined`.
- If the first two statements are `oneStepPossible()`, reduce the first two statements first.
- If the first two statements are value-inducing (e.g., `1; 2;`), remove the first statement using `contractEmpty()`.

### `VariableDeclaration`
#### Reduction
- Reduce the `init` field first. `const x = 1 + 1;`: `1+1` is an init field.
- If the `init` field is reduced, toggle substitution and reduce the statement to `StepperUndefined`.
- VariableDeclaration is always contractable. PreRedex is the variable declaration statement. PostRedexes are all variables substituted.

