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
function concurrent_execute() {}

/**
 * Assumes the head of pair <CODE>p</CODE> is a boolean
 * <CODE>b</CODE>. Sets the head of <CODE>p</CODE> to
 * <CODE>true</CODE>. Returns <CODE>b</CODE>. This is an
 * atomic operation.
 * @param {array} p - given pair
 * @returns {value} - head of pair <CODE>b</CODE>
 */
function test_and_set(p) {}

/**
 * Sets the head of pair <CODE>p</CODE> to
 * <CODE>false</CODE>. Returns <CODE>undefined</CODE>.
 * This is an atomic operation.
 * @param {array} p - given pair
 * @returns {undefined} undefined
 */
function clear(p) {}
