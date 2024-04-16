/**
 * returns
 * the current length of array <CODE>x</CODE>, which is 1 plus the
 * highest index that has been used so far in an array assignment on
 * <CODE>x</CODE>. Here literal array expressions are counted too: The
 * array <CODE>[10, 20, 30]</CODE> has a length of 3.
 * @param {array} x - given array
 * @returns {number} current length of array
 */
declare function array_length(x: any[]): number;
/**
 * returns <CODE>true</CODE> if <CODE>x</CODE>
 * is an array, and <CODE>false</CODE> if it is not.
 * @param {value} x - given value
 * @returns {boolean} whether <CODE>x</CODE> is an array
 */
declare function is_array(x: value): boolean;
