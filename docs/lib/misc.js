/**
 * checks whether a given value is a number.
 * See also <a href="https://sicp.comp.nus.edu.sg/chapters/36">textbook example</a>.
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
 * checks whether a given value is a string.
 * See also <a href="https://sicp.comp.nus.edu.sg/chapters/36">textbook example</a>.
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
 * checks whether a given value is the special value <CODE>undefined</CODE>
 * @param {value} v to be checked
 * @returns {boolean} indicating whether the value is <CODE>undefined</CODE>
 */
function is_undefined(v) {
}

/**
 * Returns number of milliseconds elapsed since January 1, 1970 00:00:00 UTC.
 * See also <a href="https://sicp.comp.nus.edu.sg/chapters/17#ex_1.22">textbook example</a>.
 * @returns {number} current time in milliseconds
 */
export function runtime() {
  return new Date().getTime()
}

/**
 * Interprets a given string <CODE>s</CODE> as an integer, 
 * using the positive integer <CODE>i</CODE> as radix, 
 * and returns the respective value.
 * <BR/>Examples: <CODE>parse_int("909", 10)</CODE> returns the number 
 * <CODE>909</CODE>, and <CODE>parse_int("-1111", 2)</CODE> returns the number 
 * <CODE>-15</CODE>.<BR/>
 * See <a href="https://www.ecma-international.org/ecma-262/9.0/index.html#sec-parseint-string-radix">ECMAScript Specification, Section 18.2.5</a> for details.
 * @param {string} s - string to be converted
 * @param {number} i - radix 
 * @returns {number} result of conversion
 */
function parse_int(s, i) {}

/**
 * The name <CODE>undefined</CODE> refers to the special value <CODE>undefined</CODE>.
 * See also <a href="https://sicp.comp.nus.edu.sg/chapters/4">textbook explanation in section 1.1.2</a>.
 * @const {undefined}
 */
const undefined = (() => {})();

/**
 * The name <CODE>NaN</CODE> refers to the special number value <CODE>NaN</CODE> ("not a number"). Note that 
 * <CODE>NaN</CODE> is a number, as specified by <CODE>is_number</CODE>.
 * See <a href="https://www.ecma-international.org/ecma-262/9.0/index.html#sec-value-properties-of-the-global-object-nan">ECMAScript Specification, Section 4.3.24</a>
 * @const {number}
 */
const NaN = 0 / 0;

/**
 * The name <CODE>Infinity</CODE> refers to the special number value <CODE>Infinity</CODE>.
 * See <a href="https://www.ecma-international.org/ecma-262/9.0/index.html#sec-value-properties-of-the-global-object-infinity">ECMAScript Specification, Section 4.3.23</a>
 * @const {number}
 */
const Infinity = 1 / 0;

/**
 * Pops up a window that displays the string <CODE>s</CODE>, provides
 * an input line for the user to enter a text, a <CODE>Cancel</CODE> button and an <CODE>OK</CODE> button. 
 * The call of <CODE>prompt</CODE>
 * suspends execution of the program until one of the two buttons is pressed. If 
 * the <CODE>OK</CODE> button is pressed, <CODE>prompt</CODE> returns the entered text as a string.
 * If the <CODE>Cancel</CODE> button is pressed, <CODE>prompt</CODE> returns a non-string value.
 * @param {string} s to be displayed in popup
 * @returns {string} entered text
 */
function prompt(s) {
}

/**
 * Optional second argument. If present, 
 * displays the given string <CODE>s</CODE>, followed by a space character, followed by the
 * value <CODE>v</CODE> in the console. 
 * If second argument not present, 
 * just displays the value <CODE>v</CODE> in the console.
 * The notation used for the display of values 
 * is consistent with 
 * <a href="http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf">JSON</a>, 
 * but also displays <CODE>undefined</CODE> and function objects.
 * @param {value} v to be displayed
 * @param {string} s to be displayed, preceding <CODE>v</CODE>, optional argument
 * @returns {value} v, the first argument value
 */
function display(v, s) {
}

/**
 * Optional second argument.
 * If present, 
 * displays the given string <CODE>s</CODE>, followed by a space character, followed by the
 * value <CODE>v</CODE> in the console with error flag. 
 * If second argument not present, 
 * just displays the value <CODE>v</CODE> in the console with error flag.
 * The evaluation
 * of any call of <CODE>error</CODE> aborts the running program immediately.
 * The notation used for the display of values 
 * is consistent with 
 * <a href="http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf">JSON</a>, 
 * but also displays <CODE>undefined</CODE> and function objects.
 * @param {value} v to be displayed
 * @param {string} s to be displayed, preceding <CODE>v</CODE>
 * @returns {value} v, the first argument value
 */
function error(v, s) {
}

/**
 * returns a string that represents the value <CODE>v</CODE>, using a
 * notation that is is consistent with 
 * <a href="http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf">JSON</a>, 
 * but also displays <CODE>undefined</CODE> and function objects.
 * See also <a href="https://sicp.comp.nus.edu.sg/chapters/62">textbook example</a>.
 * @param {value} v the argument value
 * @returns {string} string representation of v
 */
function stringify(v) {
}

