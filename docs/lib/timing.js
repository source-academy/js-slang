/**
 * **primitive**; schedules <CODE>f</CODE>, a function of no arguments, to
 * be called after <CODE>t</CODE> milliseconds, without blocking the
 * calling code. An error thrown by <CODE>f</CODE> when it eventually runs
 * is reported the way an uncaught runtime error normally is, not silently
 * swallowed.
 * @param {value} f - given function of no arguments
 * @param {number} t - delay in milliseconds
 * @returns {undefined} undefined
 */
function set_timeout(f, t) {}

/**
 * **primitive**; cancels every timer scheduled by <CODE>set_timeout</CODE>
 * that has not fired yet.
 * @returns {undefined} undefined
 */
function clear_all_timeout() {}
