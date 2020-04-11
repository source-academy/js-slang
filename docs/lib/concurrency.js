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
 * Returns the head of the array <CODE>x</CODE>, and sets the
 * head of <CODE>x</CODE> to <CODE>true</CODE>. Assumes the
 * head of the array <CODE>x</CODE> is a boolean.
 * This is an atomic operation.
 * @param {array} x - given array
 * @returns {value} - head of array <CODE>x</CODE>
 */
function test_and_set(x) {}

/**
 * Sets the head of the array <CODE>x</CODE> to
 * <CODE>false</CODE>. Returns <CODE>undefined</CODE>.
 * This is an atomic operation.
 * @param {array} x - given array
 * @returns {undefined} undefined
 */
function clear(x) {}
