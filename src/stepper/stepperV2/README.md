## Implementation Details (To be updated)
### `StepperProgram`
- If `node.body.length === 0`, the program is reduced to `StepperUndefined`.
- If the first two statements are `oneStepPossible()`, reduce the first two statements first.
- If the first two statements are value-inducing (e.g.  `1; 2;`), remove the first statement.

### `VariableDeclaration`
- Reduce the `init` field first.
- If `init` field is reduced, toggle substitution and reduce the statement to `StepperUndefined`.