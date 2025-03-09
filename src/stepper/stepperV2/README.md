## Quickstart (To be updated)
In order to work with and test the code, you can edit the file from `../__test__/StepperV2.ts` and run it with the following command:
```bash
yarn test -- stepperV2.ts --silence=false  
```
Note that the flag `--silence=false` is set in order to see the output from `console.log`.

## Implementation Details (To be updated)
### `UndefinedNode`
- Global node, literal, representing undefined

### `StepperProgram`
- If `node.body.length === 0`, the program is reduced to `StepperUndefined`.
- If the first two statements are `oneStepPossible()`, reduce the first two statements first.
- If the first two statements are value-inducing (e.g., `1; 2;`), remove the first statement.

### `VariableDeclaration`
- Reduce the `init` field first. `const x = 1 + 1;`: `1+1` is an init field.
- If the `init` field is reduced, toggle substitution and reduce the statement to `StepperUndefined`.
- VariableDeclaration is always contractable. PreRedex is the variable declaration statement. PostRedexes are all variables substituted.

#### `SubstitutedScope`
- To track the entry point for substitution, we use global state `SubstitutedScope` to track the substitution scope. Here is an example:
```typescript
SubstitutionScope.set(this.body.slice(2)); // set the second statement onwards as a scope for substitution
const secondStatementOneStep = this.body[1].oneStep(); // trigger substitution if init field has been reduced
const afterSubstitutedScope = SubstitutionScope.get(); // get the substitution scope back
SubstitutionScope.reset();
// somewhere in this.body[1] node
SubstitutionScope.substitute(identifier, value) // trigger substitution on SubstitutionScope
```