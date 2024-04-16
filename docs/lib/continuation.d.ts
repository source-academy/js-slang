/**
 * Generate a continuation <CODE>cont</CODE>,
 * and call <CODE>f(cont)</CODE>.
 * @param {function} f - A function of the form <CODE>(cont) => ...</CODE>
 * @returns the return value of <CODE>f</CODE> if cont is not consumed
 */
declare function call_cc(f: Function): void;
