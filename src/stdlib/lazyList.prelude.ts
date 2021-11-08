export const lazyListPrelude = `

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
        : is_string(xs)
        ? (is_string(ys) && xs === ys)
        :  xs === ys;
}

// returns the length of a given argument list
// assumes that the argument is a list

function length(xs) {
  return is_null(xs) ? 0 : 1 + length(tail(xs));
}

// map applies first arg f, assumed to be a unary function,
// to the elements of the second argument, assumed to be a list.
// f is applied element-by-element:
// map(f, list(1, 2)) results in list(f(1), f(2))

function map(f, xs) {
  return is_null(xs) ? null : pair(f(head(xs)), map(f, tail(xs)));
}

// build_list takes a nonnegative integer n as first argument,
// and a function fun as second argument.
// build_list returns a list of n elements, that results from
// applying fun to the numbers from 0 to n-1.

function build_list(fun, n) {
  function build(i, fun, already_built) {
    return i < 0 ? already_built : build(i - 1, fun, pair(fun(i), already_built));
  }
  return build(n - 1, fun, null);
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

function list_to_string(xs) {
    return is_null(xs)
        ? "null"
        : is_pair(xs)
            ? "[" + list_to_string(head(xs)) + "," +
                list_to_string(tail(xs)) + "]"
            : stringify(xs);
}

// reverse reverses the argument, assumed to be a list

function reverse(xs) {
  function rev(original, reversed) {
    return is_null(original) ? reversed : rev(tail(original), pair(head(original), reversed));
  }
  return rev(xs, null);
}

// append first argument, assumed to be a list, to the second argument.
// In the result null at the end of the first argument list
// is replaced by the second argument, regardless what the second
// argument consists of.

function append(xs, ys) {
  return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
}

// member looks for a given first-argument element in the
// second argument, assumed to be a list. It returns the first
// postfix sublist that starts with the given element. It returns null if the
// element does not occur in the list

function member(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? xs : member(v, tail(xs));
}

// removes the first occurrence of a given first-argument element
// in second-argument, assmed to be a list. Returns the original
// list if there is no occurrence.

function remove(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? tail(xs) : pair(head(xs), remove(v, tail(xs)));
}

// Similar to remove, but removes all instances of v
// instead of just the first

function remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
    ? remove_all(v, tail(xs))
    : pair(head(xs), remove_all(v, tail(xs)));
}

// filter returns the sublist of elements of the second argument
// (assumed to be a list), for which the given predicate function
// returns true.

function filter(pred, xs) {
  return is_null(xs)
    ? xs
    : pred(head(xs))
    ? pair(head(xs), filter(pred, tail(xs)))
    : filter(pred, tail(xs));
}

// enumerates numbers starting from start, assumed to be a number,
// using a step size of 1, until the number exceeds end, assumed
// to be a number

function enum_list(start, end) {
  const newStart = start + 1;
  return start > end ? null : pair(start, enum_list(newStart, end));
}

// Returns the item in xs (assumed to be a list) at index n,
// assumed to be a nonnegative integer.
// Note: the first item is at position 0

function list_ref(xs, n) {
  const rest = tail(xs);
  return n === 0 ? head(xs) : list_ref(rest, n - 1);
}

// accumulate applies an operation op (assumed to be a binary function)
// to elements of sequence (assumed to be a list) in a right-to-left order.
// first apply op to the last element and initial, resulting in r1, then to
// the  second-last element and r1, resulting in r2, etc, and finally
// to the first element and r_n-1, where n is the length of the
// list.
// accumulate(op, zero, list(1, 2, 3)) results in
// op(1, op(2, op(3, zero)))

function accumulate(f, initial, xs) {
  return is_null(xs) ? initial : f(head(xs), accumulate(f, initial, tail(xs)));
}
`
