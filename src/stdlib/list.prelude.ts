export const listPrelude = `

// equal computes the structural equality
// over its arguments

function equal(xs, ys) {
  return is_pair(xs)
  ? (is_pair(ys) &&
    equal(head(xs), head(ys)) &&
    equal(tail(xs), tail(ys)))
  : is_null(xs)
  ? is_null(ys)
  : is_number(xs)
  ? (is_number(ys) && xs === ys)
  : is_boolean(xs)
  ? (is_boolean(ys) && ((xs && ys) || (!xs && !ys)))
  : is_string(xs)
  ? (is_string(ys) && xs === ys)
  : is_undefined(xs)
  ? is_undefined(ys)
  : is_function(xs)
    // we know now that xs is a function,
    // but we use an if check anyway to make use of the type predicate
  ? (is_function(ys) && xs === ys)
  : false;
}


// returns the length of a given argument list
// assumes that the argument is a list

function $length(xs, acc) {
    return is_null(xs) ? acc : $length(tail(xs), acc + 1);
}
function length(xs) {
  return $length(xs, 0);
}

// map applies first arg f, assumed to be a unary function,
// to the elements of the second argument, assumed to be a list.
// f is applied element-by-element:
// map(f, list(1, 2)) results in list(f(1), f(2))

function $map(f, xs, acc) {
    return is_null(xs)
           ? reverse(acc)
           : $map(f, tail(xs), pair(f(head(xs)), acc));
}
function map(f, xs) {
    return $map(f, xs, null);
}

// build_list takes a a function fun as first argument, 
// and a nonnegative integer n as second argument,
// build_list returns a list of n elements, that results from
// applying fun to the numbers from 0 to n-1.

function $build_list(i, fun, already_built) {
    return i < 0 ? already_built : $build_list(i - 1, fun, pair(fun(i), already_built));
}

function build_list(fun, n) {
  return $build_list(n - 1, fun, null);
}

// for_each applies first arg fun, assumed to be a unary function,
// to the elements of the second argument, assumed to be a list.
// fun is applied element-by-element:
// for_each(fun, list(1, 2)) results in the calls fun(1) and fun(2).
// for_each returns true.

function for_each(fun, xs) {
  if (is_null(xs)) {
    return true;
  } else {
    fun(head(xs));
    return for_each(fun, tail(xs));
  }
}

// list_to_string returns a string that represents the argument list.
// It applies itself recursively on the elements of the given list.
// When it encounters a non-list, it applies to_string to it.

function $list_to_string(xs, cont) {
    return is_null(xs)
        ? cont("null")
        : is_pair(xs)
        ? $list_to_string(
              head(xs),
              x => $list_to_string(
                       tail(xs),
                       y => cont("[" + x + "," + y + "]")))
        : cont(stringify(xs));
}

function list_to_string(xs) {
    return $list_to_string(xs, x => x);
}

// reverse reverses the argument, assumed to be a list

function $reverse(original, reversed) {
    return is_null(original)
           ? reversed
           : $reverse(tail(original), pair(head(original), reversed));
}

function reverse(xs) {
    return $reverse(xs, null);
}

// append first argument, assumed to be a list, to the second argument.
// In the result null at the end of the first argument list
// is replaced by the second argument, regardless what the second
// argument consists of.

function $append(xs, ys, cont) {
    return is_null(xs)
           ? cont(ys)
           : $append(tail(xs), ys, zs => cont(pair(head(xs), zs)));
}

function append(xs, ys) {
    return $append(xs, ys, xs => xs);
}

// member looks for a given first-argument element in the
// second argument, assumed to be a list. It returns the first
// postfix sublist that starts with the given element. It returns null if the
// element does not occur in the list

function member(v, xs) {
  return is_null(xs)
         ? null
	 : v === head(xs)
	 ? xs
	 : member(v, tail(xs));
}

// removes the first occurrence of a given first-argument element
// in second-argument, assmed to be a list. Returns the original
// list if there is no occurrence.

function $remove(v, xs, acc) {
  // Ensure that typechecking of append and reverse are done independently
  const app = append;
  const rev = reverse;
  return is_null(xs)
         ? app(rev(acc), xs)
         : v === head(xs)
         ? app(rev(acc), tail(xs))
         : $remove(v, tail(xs), pair(head(xs), acc));
}

function remove(v, xs) {
    return $remove(v, xs, null);
}

// Similar to remove, but removes all instances of v
// instead of just the first

function $remove_all(v, xs, acc) {
  // Ensure that typechecking of append and reverse are done independently
  const app = append;
  const rev = reverse;
  return is_null(xs)
         ? app(rev(acc), xs)
         : v === head(xs)
         ? $remove_all(v, tail(xs), acc)
         : $remove_all(v, tail(xs), pair(head(xs), acc));
}

function remove_all(v, xs) {
    return $remove_all(v, xs, null);
}

// filter returns the sublist of elements of the second argument
// (assumed to be a list), for which the given predicate function
// returns true.

function $filter(pred, xs, acc) {
  return is_null(xs)
    ? reverse(acc)
    : pred(head(xs))
    ? $filter(pred, tail(xs), pair(head(xs), acc))
    : $filter(pred, tail(xs), acc);
}

function filter(pred, xs) {
    return $filter(pred, xs, null);
}

// enumerates numbers starting from start, assumed to be a number,
// using a step size of 1, until the number exceeds end, assumed
// to be a number

function $enum_list(start, end, acc) {
  // Ensure that typechecking of reverse are done independently
  const rev = reverse;
  return start > end
         ? rev(acc)
         : $enum_list(start + 1, end, pair(start, acc));
}

function enum_list(start, end) {
    return $enum_list(start, end, null);
}

// Returns the item in xs (assumed to be a list) at index n,
// assumed to be a nonnegative integer.
// Note: the first item is at position 0

function list_ref(xs, n) {
  return n === 0
         ? head(xs)
         : list_ref(tail(xs), n - 1);
}

// accumulate applies an operation op (assumed to be a binary function)
// to elements of sequence (assumed to be a list) in a right-to-left order.
// first apply op to the last element and initial, resulting in r1, then to
// the  second-last element and r1, resulting in r2, etc, and finally
// to the first element and r_n-1, where n is the length of the
// list.
// accumulate(op, zero, list(1, 2, 3)) results in
// op(1, op(2, op(3, zero)))

function $accumulate(f, initial, xs, cont) {
    return is_null(xs)
           ? cont(initial)
           : $accumulate(f, initial, tail(xs), x => cont(f(head(xs), x)));
}

function accumulate(f, initial, xs) {
  return $accumulate(f, initial, xs, x => x);
}
`
