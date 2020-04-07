export const constraintStore = new Map()

export function updateTypeConstraints(newConstraintLhs: number, newConstraintRhs: number | string) {
    // step 3a. Add new constraint to constraintStore map
    // e.g. T1 = T2, T2 = number
    constraintStore.set(newConstraintLhs, newConstraintRhs)

    // step 3b. Attempt to reduce type constraints to solved form
    // If type error found, stop and throw error
    // .. todo ..
}