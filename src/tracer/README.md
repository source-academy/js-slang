# Stepper Documentation 
## High-level ideas
Our stepper is a program that reduces a piece of code to its simplest form until it can no longer be reduced. While the idea sounds abstract, the step-by-step reduction of code allows us to add explanations, further aiding student learning when they want to scrutinize how the code is evaluated. The method is formally defined as beta reduction.

### Expression stepper
In order to implement the program with such functionalities, we have to first parse the program string into certain structure that we can approach to, so-called Abstract Syntax Tree (AST). For instance, string `2 * 3` can be converted to AST as `BinExp[* Lit[2] Lit[3]]`, where `BinExp` is a binary expression node consisting of two literals `2` and `3` combined with operator `*`. Note that our programming language consists of various node types, it's difficult to implement a parser from scratch to cover all cases. Luckily, the library `acorn` helps us generate the AST from a piece of string which is very convenient. 

Here comes the fun part. How are we supposed to evaluate `BinExp[* Lit[2] Lit[3]]`? Since we cannot do anything further, we just simply **contract** them to `Lit[6]` and we are done. However, considering the AST `BinExp[* Lit[2] BinExp[+ Lit[3] Lit[4]]]` generated from `2 * (3 + 4)`, if we contract this expression directly, we will get `2 * {OBJECT}` which is not computable since one of the operands is not a number. Hence, we have to contract `BinExp[+ Lit[3] Lit[4]]]` first before contracting the outer `BinExp`.  Note that our stepper only contracts one node for each step. This is our main constraint that we use during the implementation.

### Augmenting functionalities
Since our stepper takes AST (of any types) as an input and recursively navigate along the tree to find the next node to contract. There are many functionalities that we have to perform on each AST (such as contracting the AST as discussed in the previous section). Intuitively, we should add these functionalities as methods for each of the AST classes. Since the AST obtaining from the library is an `ESTree` interface, we have to implement our own concrete classes inherited from the ESTree AST Nodes. We also have to create our own convertor to convert the former ESTree into our own Stepper AST:

```typescript
// interface.ts
export interface StepperBaseNode {
  type: string
  isContractible(): boolean
  isOneStepPossible(): boolean
  contract(): StepperBaseNode
  oneStep(): StepperBaseNode
  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode
  freeNames(): string[]
  allNames(): string[]
  rename(before: string, after: string): StepperBaseNode
}
```


// Not finished

## Quickstart
First of all, make sure that you have already installed `js-slang` using `yarn`. There are many possible ways that you can work and test the code. One of my personal solution is using `yarn test`. During the development, you can edit the file from `../__test__/tracer_debug.ts` and run it with the following command:
```bash
yarn test -- tracer_debug.ts  > testOutput.log
```
Note that the flag `--silence=false` is set in order to see the output from `console.log`. In order to fully test the stepper, you can execute the following command.
```bash
yarn test -- tracer_full.ts` 
```
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
  freeNames(): string[]
  allNames(): string[]
  rename(before: string, after: string): StepperBaseNode
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
