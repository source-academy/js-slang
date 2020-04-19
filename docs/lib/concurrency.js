/**
 * Setup multiple threads for concurrent execution. For each
 * nullary function <CODE>f_i</CODE> that returns <CODE>undefined</CODE>,
 * setup a thread <CODE>t_i</CODE> that executes the code in the body of
 * <CODE>f_i</CODE>. The thread that called <CODE>concurrent_execute</CODE>
 * also executes concurrently with all <CODE>t_i</CODE>. Returns
 * <CODE>undefined</CODE>. This is an atomic operation.
 * @param {function} f_1,f_2,...,f_n - given nullary functions
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
