/**
 * Setup multiple threads for concurrent execution. For each
 * function <CODE>f_i</CODE>,
 * setup a thread <CODE>t_i</CODE> that executes the body of
 * <CODE>f_i</CODE>. Any parameters of <CODE>f_i</CODE> refer
 * to <CODE>undefined</CODE> during execution.
 * The thread that called <CODE>concurrent_execute</CODE>
 * runs concurrently with all <CODE>t_i</CODE>. Returns
 * <CODE>undefined</CODE>. This is an atomic operation.
 * @param {function} f_1,f_2,...,f_n - given functions
 * @returns {undefined} undefined
 */
declare function concurrent_execute(): undefined;
/**
 * Assumes the head of pair <CODE>p</CODE> is a boolean
 * <CODE>b</CODE>. Sets the head of <CODE>p</CODE> to
 * <CODE>true</CODE>. Returns <CODE>b</CODE>. This is an
 * atomic operation.
 * @param {array} p - given pair
 * @returns {value} - head of pair <CODE>b</CODE>
 */
declare function test_and_set(p: any[]): value;
/**
 * Sets the head of pair <CODE>p</CODE> to
 * <CODE>false</CODE>. Returns <CODE>undefined</CODE>.
 * This is an atomic operation.
 * @param {array} p - given pair
 * @returns {undefined} undefined
 */
declare function clear(p: any[]): undefined;
