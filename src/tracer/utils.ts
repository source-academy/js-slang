import { StepperVariableDeclarator } from "./nodes/Statement/VariableDeclaration";

/*
Generate new name for alpha renaming
X -> X_1 -> X_2 -> X_3 -> ...
*/
export function getFreshName(name: string): string {
    const regex = /(.*)_(\d+)$/;
    const match = name.match(regex);
    if (match) {
        const nextOrder = parseInt(match[2], 10) + 1;
        return match[1] + nextOrder.toString();
    } else {
        return name + "_1";
    }
}


// Assign mu term for arrow function expression
export function assignMuTerms(declarations: StepperVariableDeclarator[]): StepperVariableDeclarator[] {
    // Scan out arrow function expression and assign mu term
    declarations = declarations.map(
    (declarator) => declarator.init && declarator.init.type === "ArrowFunctionExpression"
        ? new StepperVariableDeclarator(declarator.id, declarator.init.assignName(declarator.id.name))
        : declarator
    )
    return declarations;
}