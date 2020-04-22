// \texttt{non-det.js START} \begin{lstlisting}

/**
 * Given <CODE>n</CODE> values, creates a choice point whose value is chosen, at run-time, from the set <CODE>e1, e2, ..., en<CODE>.<br>
 * If <CODE>n</CODE> is 0, it forces the language processor to backtrack to the most recent <CODE>amb</CODE> expression without returning a value.
 * @param {value} e1,e2,...en - given values
 * @returns {value} a value from the given values
 */
function amb(e1, e2, ...en) {}

/**
 * Prevents the language processor from backtracking any further beyond the current statement.
 */
function cut() {}

/**
 * Forces the language processor to backtrack to the most recent <CODE>amb<CODE> expression, if and only if <CODE>pred</CODE> evaluates to <CODE>false</CODE>.
 * @param {boolean} pred - given predicate
 * @returns {string} - a message indicating that the given predicate is <CODE>true</CODE>
 */
function require(pred) {
    return pred ? "Satisfied require" : amb();
}


/**
 * Indicates if the Material Conditional connective between two boolean expressions is satisfied.<br>
 * If <CODE>P</CODE>, then <CODE>Q</CODE>.
 * @param {boolean} P - antecedent of the conditional
 * @param {boolean} Q - consequent of the conditional
 * @return {boolean} - a boolean according to the truth table of Material Conditional
 */
function implication(P, Q) {
    return !P || Q;
}

/**
 * Indicates if the Material Biconditional connective between two boolean expressions is satisfied.<br>
 * (If <CODE>P</CODE>, then <CODE>Q</CODE>) AND (If <CODE>Q</CODE>, then <CODE>P</CODE>).
 * @param {boolean} P - antecedent and consequent of the conditional
 * @param {boolean} Q - antecedent and consequent of the conditional
 * @return {boolean} - a boolean according to the truth table of Material Biconditional
 */
function bi_implication(P, Q) {
    return implication(P, Q) && implication(Q, P);
}

/**
 * Non-deterministically returns an element from a given list.
 * @param {list} xs - given list
 * @returns {value} - an element from <CODE>xs</CODE>
 */
function an_element_of(xs) {
    require(!is_null(xs));
    return amb(head(xs), an_element_of(tail(xs)));
}

/**
 * Non-deterministically returns an integer between <CODE>n</CODE> and <CODE>m</CODE> (inclusively).
 * @param {number} n - lower bound
 * @param {number} m - upper bound
 * @returns {number} - a number between n and m (inclusive)
 */
function an_integer_between(n, m) {
    return n > m ? amb() : amb(n, an_integer_between(n + 1, m));
}

// \end{lstlisting} // \texttt{non-det.js END}
