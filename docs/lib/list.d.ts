/**
 * makes a pair whose head (first component) is <CODE>x</CODE>
 * and whose tail (second component) is <CODE>y</CODE>.
 * @param {value} x - given head
 * @param {value} y - given tail
 * @returns {pair} pair with <CODE>x</CODE> as head and <CODE>y</CODE> as tail.
 */
declare function pair(x: value, y: value): typeof pair;
/**
 * returns <CODE>true</CODE> if <CODE>x</CODE> is a
 * pair and false otherwise.
 * @param {value} x - given value
 * @returns {boolean} whether <CODE>x</CODE> is a pair
 */
declare function is_pair(x: value): boolean;
/**
 * returns head (first component) of given pair <CODE>p</CODE>
 * @param {pair} p - given pair
 * @returns {value} head of <CODE>p</CODE>
 */
declare function head(p: typeof pair): value;
/**
 * returns tail (second component of given pair <CODE>p</CODE>
 * @param {pair} p - given pair
 * @returns {value} tail of <CODE>p</CODE>
 */
declare function tail(p: typeof pair): value;
/**
 * returns <CODE>true</CODE> if <CODE>x</CODE> is the
 * empty list <CODE>null</CODE>, and <CODE>false</CODE> otherwise.
 * @param {value} x - given value
 * @returns {boolean} whether <CODE>x</CODE> is <CODE>null</CODE>
 */
declare function is_null(x: value): boolean;
/**
 * Returns <CODE>true</CODE> if
 * <CODE>xs</CODE> is a list as defined in the textbook, and
 * <CODE>false</CODE> otherwise. Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(1)</CODE>, where <CODE>n</CODE>
 * is the length of the
 * chain of <CODE>tail</CODE> operations that can be applied to <CODE>xs</CODE>.
 * recurses down the list and checks that it ends with the empty list null
 * @param {value} xs - given candidate
 * @returns whether {xs} is a list
 */
declare function is_list(xs: value): void;
/**
 * Given <CODE>n</CODE> values, returns a list of length <CODE>n</CODE>.
 * The elements of the list are the given values in the given order.
 * @param {value} value1,value2,...,value_n - given values
 * @returns {list} list containing all values
 */
declare function list(value1: value, value2: any, ...values: any[]): typeof list;
/**
 * visualizes <CODE>x</CODE> in a separate drawing
 * area in the Source Academy using a box-and-pointer diagram; time, space:
 * O(n), where n is the total number of data structures such as
 * pairs in all the separate structures provided in <CODE>x</CODE>.
 * @param {value} value1,value2,...,value_n - given values
 * @returns {value} given <CODE>x</CODE>
 */
declare function draw_data(value1: value, value2: any, ...values: any[]): value;
/**
 * Returns <CODE>true</CODE> if both
 * have the same structure with respect to <CODE>pair</CODE>,
 * and identical values at corresponding leave positions (places that are not
 * themselves pairs), and <CODE>false</CODE> otherwise. For the "identical",
 * the values need to have the same type, otherwise the result is
 * <CODE>false</CODE>. If corresponding leaves are boolean values, these values
 * need to be the same. If both are <CODE>undefined</CODE> or both are
 * <CODE>null</CODE>, the result is <CODE>true</CODE>. Otherwise they are compared
 * with <CODE>===</CODE> (using the definition of <CODE>===</CODE> in the
 * respective Source language in use). Time, space:
 * <CODE>O(n)</CODE>, where <CODE>n</CODE> is the number of pairs in
 * <CODE>x</CODE>.
 * @param {value} x - given value
 * @param {value} y - given value
 * @returns {boolean} whether <CODE>x</CODE> is structurally equal to <CODE>y</CODE>
 */
declare function equal(xs: any, ys: any): boolean;
/**
 * Returns the length of the list
 * <CODE>xs</CODE>.
 * Iterative process; time: <CODE>O(n)</CODE>, space:
 * <CODE>O(1)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * @param {list} xs - given list
 * @returns {number} length of <CODE>xs</CODE>
 */
declare function length(xs: typeof list): number;
declare function $length(xs: any, acc: any): any;
/**
 * Returns a list that results from list
 * <CODE>xs</CODE> by element-wise application of unary function <CODE>f</CODE>.
 * Iterative process; time: <CODE>O(n)</CODE>,
 * space: <CODE>O(n)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * <CODE>f</CODE> is applied element-by-element:
 * <CODE>map(f, list(1, 2))</CODE> results in <CODE>list(f(1), f(2))</CODE>.
 * @param {function} f - unary
 * @param {list} xs - given list
 * @returns {list} result of mapping
 */
declare function map(f: Function, xs: typeof list): typeof list;
declare function $map(f: any, xs: any, acc: any): any;
/**
 * Makes a list with <CODE>n</CODE>
 * elements by applying the unary function <CODE>f</CODE>
 * to the numbers 0 to <CODE>n - 1</CODE>, assumed to be a nonnegative integer.
 * Iterative process; time: <CODE>O(n)</CODE>, space: <CODE>O(n)</CODE>.
 * @param {function} f - unary function
 * @param {number} n - given nonnegative integer
 * @returns {list} resulting list
 */
declare function build_list(fun: any, n: number): typeof list;
declare function $build_list(i: any, fun: any, already_built: any): any;
/**
 * Applies unary function <CODE>f</CODE> to every
 * element of the list <CODE>xs</CODE>.
 * Iterative process; time: <CODE>O(n)</CODE>, space: <CODE>O(1)</CODE>,
 * Where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * <CODE>f</CODE> is applied element-by-element:
 * <CODE>for_each(fun, list(1, 2))</CODE> results in the calls
 * <CODE>fun(1)</CODE> and <CODE>fun(2)</CODE>.
 * @param {function} f - unary
 * @param {list} xs - given list
 * @returns {boolean} true
 */
declare function for_each(fun: any, xs: typeof list): boolean;
/**
 * Returns a string that represents
 * list <CODE>xs</CODE> using the text-based box-and-pointer notation
 * <CODE>[...]</CODE>.
 * @param {list} xs - given list
 * @returns {string} <CODE>xs</CODE> converted to string
 */
declare function list_to_string(xs: typeof list): string;
declare function $list_to_string(xs: any, cont: any): any;
/**
 * Returns list <CODE>xs</CODE> in reverse
 * order. Iterative process; time: <CODE>O(n)</CODE>,
 * space: <CODE>O(n)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * The process is iterative, but consumes space <CODE>O(n)</CODE>
 * because of the result list.
 * @param {list} xs - given list
 * @returns {list} <CODE>xs</CODE> in reverse
 */
declare function reverse(xs: typeof list): typeof list;
declare function $reverse(original: any, reversed: any): any;
/**
 * Returns a list that results from
 * appending the list <CODE>ys</CODE> to the list <CODE>xs</CODE>.
 * Iterative process; time: <CODE>O(n)</CODE>, space:
 * <CODE>O(n)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * In the result, null at the end of the first argument list
 * is replaced by the second argument, regardless what the second
 * argument consists of.
 * @param {list} xs - given first list
 * @param {list} ys - given second list
 * @returns {list} result of appending <CODE>xs</CODE> and <CODE>ys</CODE>
 */
declare function append(xs: typeof list, ys: typeof list): typeof list;
declare function $append(xs: any, ys: any, cont: any): any;
/**
 * Returns first postfix sublist
 * whose head is identical to
 * <CODE>v</CODE> (using <CODE>===</CODE>); returns <CODE>null</CODE> if the
 * element does not occur in the list.
 * Iterative process; time: <CODE>O(n)</CODE>,
 * space: <CODE>O(1)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * @param {value} v - given value
 * @param {list} xs - given list
 * @returns {list} postfix sublist that starts with <CODE>v</CODE>
 */
declare function member(v: value, xs: typeof list): typeof list;
/** Returns a list that results from
 * <CODE>xs</CODE> by removing the first item from <CODE>xs</CODE> that
 * is identical (<CODE>===</CODE>) to <CODE>v</CODE>.
 * Returns the original
 * list if there is no occurrence. Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(n)</CODE>, where <CODE>n</CODE>
 * is the length of <CODE>xs</CODE>.
 * @param {value} v - given value
 * @param {list} xs - given list
 * @returns {list} <CODE>xs</CODE> with first occurrence of <CODE>v</CODE> removed
 */
declare function remove(v: value, xs: typeof list): typeof list;
declare function $remove(v: any, xs: any, acc: any): any;
/**
 * Returns a list that results from
 * <CODE>xs</CODE> by removing all items from <CODE>xs</CODE> that
 * are identical (<CODE>===</CODE>) to <CODE>v</CODE>.
 * Returns the original
 * list if there is no occurrence.
 * Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(n)</CODE>, where <CODE>n</CODE>
 * is the length of <CODE>xs</CODE>.
 * @param {value} v - given value
 * @param {list} xs - given list
 * @returns {list} <CODE>xs</CODE> with all occurrences of <CODE>v</CODE> removed
 */
declare function remove_all(v: value, xs: typeof list): typeof list;
declare function $remove_all(v: any, xs: any, acc: any): any;
/**
 * Returns a list that contains
 * only those elements for which the one-argument function
 * <CODE>pred</CODE>
 * returns <CODE>true</CODE>.
 * Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(n)</CODE>,
 * where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * @param {function} pred - unary function returning boolean value
 * @param {list} xs - given list
 * @returns {list} list with those elements of <CODE>xs</CODE> for which <CODE>pred</CODE> holds.
 */
declare function filter(pred: Function, xs: typeof list): typeof list;
declare function $filter(pred: any, xs: any, acc: any): any;
/**
 * Returns a list that enumerates
 * numbers starting from <CODE>start</CODE> using a step size of 1, until
 * the number exceeds (<CODE>&gt;</CODE>) <CODE>end</CODE>.
 * Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(n)</CODE>,
 * where <CODE>n</CODE> is <CODE>end - start</CODE>.
 * @param {number} start - starting number
 * @param {number} end - ending number
 * @returns {list} list from <CODE>start</CODE> to <CODE>end</CODE>
 */
declare function enum_list(start: number, end: number): typeof list;
declare function $enum_list(start: any, end: any, acc: any): any;
/**
 * Returns the element
 * of list <CODE>xs</CODE> at position <CODE>n</CODE>,
 * where the first element has index 0.
 * Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(1)</CODE>,
 * where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * @param {list} xs - given list
 * @param {number} n - given position
 * @returns {value} item in <CODE>xs</CODE> at position <CODE>n</CODE>
 */
declare function list_ref(xs: typeof list, n: number): value;
/** Applies binary
 * function <CODE>f</CODE> to the elements of <CODE>xs</CODE> from
 * right-to-left order, first applying <CODE>f</CODE> to the last element
 * and the value <CODE>initial</CODE>, resulting in <CODE>r</CODE><SUB>1</SUB>,
 * then to the
 * second-last element and <CODE>r</CODE><SUB>1</SUB>, resulting in
 * <CODE>r</CODE><SUB>2</SUB>,
 * etc, and finally
 * to the first element and <CODE>r</CODE><SUB>n-1</SUB>, where
 * <CODE>n</CODE> is the length of the
 * list. Thus, <CODE>accumulate(f,zero,list(1,2,3))</CODE> results in
 * <CODE>f(1, f(2, f(3, zero)))</CODE>.
 * Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(n)</CODE>,
 * where <CODE>n</CODE> is the length of <CODE>xs</CODE>
 * assuming <CODE>f</CODE> takes constant time.
 * @param {function} f - binary function
 * @param {value} initial - initial value
 * @param {list} xs - given list
 * @returns {value} result of accumulating <CODE>xs</CODE> using <CODE>f</CODE> starting with <CODE>initial</CODE>
 */
declare function accumulate(f: Function, initial: value, xs: typeof list): value;
declare function $accumulate(f: any, initial: any, xs: any, cont: any): any;
/**
 *  Optional second argument.
 *  Similar to <CODE>display</CODE>, but formats well-formed lists nicely if detected.
 * @param {value} xs - list structure to be displayed
 * @param {string} s to be displayed, preceding <CODE>xs</CODE>
 * @returns {value} xs, the first argument value
 */
declare function display_list(xs: value, s: string): value;
