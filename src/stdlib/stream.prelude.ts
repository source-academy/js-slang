export const streamPrelude = `

// Supporting streams in the Scheme style, following
// "stream discipline"

// is_stream recurses down the stream and checks that it ends with the
// empty list null

function is_stream(xs) {
  return is_null(xs) ||
    (is_pair(xs) &&
    is_function(tail(xs)) &&
    arity(tail(xs)) === 0 &&
    is_stream(stream_tail(xs)));
}

// A stream is either null or a pair whose tail is
// a nullary function that returns a stream.

function list_to_stream(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs),
      () => list_to_stream(tail(xs)));
}

// stream_to_list transforms a given stream to a list
// Lazy? No: stream_to_list needs to force the whole stream
function stream_to_list(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs), stream_to_list(stream_tail(xs)));
}

// stream_length returns the length of a given argument stream
// throws an exception if the argument is not a stream
// Lazy? No: The function needs to explore the whole stream
function stream_length(xs) {
  return is_null(xs)
    ? 0
    : 1 + stream_length(stream_tail(xs));
}

// stream_map applies first arg f to the elements of the second
// argument, assumed to be a stream.
// f is applied element-by-element:
// stream_map(f,list_to_stream(list(1,2)) results in
// the same as list_to_stream(list(f(1),f(2)))
// stream_map throws an exception if the second argument is not a
// stream, and if the second argument is a nonempty stream and the
// first argument is not a function.
// Lazy? Yes: The argument stream is only explored as forced by
//            the result stream.
function stream_map(f, s) {
  return is_null(s)
    ? null
    : pair(f(head(s)),
      () => stream_map(f, stream_tail(s)));
}

// build_stream takes a function fun as first argument, 
// and a nonnegative integer n as second argument,
// build_stream returns a stream of n elements, that results from
// applying fun to the numbers from 0 to n-1.
// Lazy? Yes: The result stream forces the applications of fun
//            for the next element
function build_stream(fun, n) {
  function build(i) {
    return i >= n
      ? null
      : pair(fun(i),
        () => build(i + 1));
  }
  return build(0);
}

// stream_for_each applies first arg fun to the elements of the stream
// passed as second argument. fun is applied element-by-element:
// for_each(fun,list_to_stream(list(1, 2,null))) results in the calls fun(1)
// and fun(2).
// stream_for_each returns true.
// stream_for_each throws an exception if the second argument is not a
// stream, and if the second argument is a nonempty stream and the
// first argument is not a function.
// Lazy? No: stream_for_each forces the exploration of the entire stream
function stream_for_each(fun, xs) {
  if (is_null(xs)) {
    return true;
  } else {
    fun(head(xs));
    return stream_for_each(fun, stream_tail(xs));
  }
}

// stream_reverse reverses the argument stream
// stream_reverse throws an exception if the argument is not a stream.
// Lazy? No: stream_reverse forces the exploration of the entire stream
function stream_reverse(xs) {
  function rev(original, reversed) {
    return is_null(original)
      ? reversed
      : rev(stream_tail(original),
        pair(head(original), () => reversed));
  }
  return rev(xs, null);
}

// stream_append appends first argument stream and second argument stream.
// In the result, null at the end of the first argument stream
// is replaced by the second argument stream
// stream_append throws an exception if the first argument is not a
// stream.
// Lazy? Yes: the result stream forces the actual append operation
function stream_append(xs, ys) {
  return is_null(xs)
    ? ys
    : pair(head(xs),
      () => stream_append(stream_tail(xs), ys));
}

// stream_member looks for a given first-argument element in a given
// second argument stream. It returns the first postfix substream
// that starts with the given element. It returns null if the
// element does not occur in the stream
// Lazy? Sort-of: stream_member forces the stream only until the element is found.
function stream_member(x, s) {
  return is_null(s)
    ? null
    : head(s) === x
      ? s
      : stream_member(x, stream_tail(s));
}

// stream_remove removes the first occurrence of a given first-argument element
// in a given second-argument list. Returns the original list
// if there is no occurrence.
// Lazy? Yes: the result stream forces the construction of each next element
function stream_remove(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_tail(xs)
      : pair(head(xs),
        () => stream_remove(v, stream_tail(xs)));
}

// stream_remove_all removes all instances of v instead of just the first.
// Lazy? Yes: the result stream forces the construction of each next element
function stream_remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_remove_all(v, stream_tail(xs))
      : pair(head(xs), () => stream_remove_all(v, stream_tail(xs)));
}

// filter returns the substream of elements of given stream s
// for which the given predicate function p returns true.
// Lazy? Yes: The result stream forces the construction of
//            each next element. Of course, the construction
//            of the next element needs to go down the stream
//            until an element is found for which p holds.
function stream_filter(p, s) {
  return is_null(s)
    ? null
    : p(head(s))
      ? pair(head(s),
        () => stream_filter(p, stream_tail(s)))
      : stream_filter(p, stream_tail(s));
}

// enumerates numbers starting from start,
// using a step size of 1, until the number
// exceeds end.
// Lazy? Yes: The result stream forces the construction of
//            each next element
function enum_stream(start, end) {
  return start > end
    ? null
    : pair(start,
      () => enum_stream(start + 1, end));
}

// integers_from constructs an infinite stream of integers
// starting at a given number n
// Lazy? Yes: The result stream forces the construction of
//            each next element
function integers_from(n) {
  return pair(n,
    () => integers_from(n + 1));
}

// eval_stream constructs the list of the first n elements
// of a given stream s
// Lazy? Sort-of: eval_stream only forces the computation of
//                the first n elements, and leaves the rest of
//                the stream untouched.
function eval_stream(s, n) {
    function es(s, n) {
        return n === 1 
               ? list(head(s))
               : pair(head(s), 
                      es(stream_tail(s), n - 1));
    }
    return n === 0 
           ? null
           : es(s, n);
}

// Returns the item in stream s at index n (the first item is at position 0)
// Lazy? Sort-of: stream_ref only forces the computation of
//                the first n elements, and leaves the rest of
//                the stream untouched.
function stream_ref(s, n) {
  return n === 0
    ? head(s)
    : stream_ref(stream_tail(s), n - 1);
}
`
