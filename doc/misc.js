/**
 * checks whether a given value is a number
 * @param {value} v to be checked
 * @returns {boolean} indicating whether the value is a number
 */
function is_number(v) {
}

/**
 * checks whether a given value is a boolean
 * @param {value} v to be checked
 * @returns {boolean} indicating whether the value is a boolean
 */
function is_boolean(v) {
}

/**
 * checks whether a given value is a string
 * @param {value} v to be checked
 * @returns {boolean} indicating whether the value is a string
 */
function is_string(v) {
}

/**
 * checks whether a given value is a function
 * @param {value} v to be checked
 * @returns {boolean} indicating whether the value is a function
 */
function is_function(v) {
}



/**
 * interprets the {string} str as an integer, using the positive integer 
 * i as radix, and returns the respective value,
 * see <a href="https://www.ecma-international.org/ecma-262/9.0/index.html#sec-parseint-string-radix">ECMAScript Specification, Section 18.2.5</a>
 * @param {string} str to be converted
 * @param {number} radix 
 * @returns {number} result of conversion
 */
export function parse_int(str, radix) {
}

export function runtime() {
  return new Date().getTime()
}
