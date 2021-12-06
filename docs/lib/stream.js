// \texttt{stream.js START} \begin{lstlisting}

// Supporting streams in the Scheme style, following
// "stream discipline"

/**
 * assumes that the tail (second component) of the
 * pair {x} is a nullary function, and returns the result of
 * applying that function. Throws an exception if the argument 
 * is not a pair, or if the tail is not a function.
 * Laziness: Yes: {stream_tail} only forces the direct tail 
 * stream, but not the rest of the stream, i.e. not the tail 
 * of the tail, etc.
 * @param {Stream} xs - given stream
 * @returns {Stream} result stream (if stream discipline is used)
 */

function stream_tail(xs) {
    if (is_pair(xs)) {
	const the_tail = tail(xs);
	if (is_function(the_tail)) {
	    return the_tail();
	} else {
	    error(the_tail,
		  'stream_tail(xs) expects a function as ' +
		  'the tail of the argument pair xs, ' +
		  'but encountered ');
	}
    } else {
	error(xs, 'stream_tail(xs) expects a pair as ' +
	      'argument xs, but encountered ');
    }
}

/**
 * Returns <CODE>true</CODE> if
 * <CODE>xs</CODE> is a stream as defined in the textbook, and
 * <CODE>false</CODE> otherwise. Iterative process; 
 * time: <CODE>O(n)</CODE>, space: <CODE>O(1)</CODE>, where <CODE>n</CODE>
 * is the length of the 
 * chain of <CODE>stream_tail</CODE> operations that can be applied to <CODE>xs</CODE>.
 * recurses down the stream and checks that it ends with the empty stream null.
 * Laziness:  No: <CODE>is_stream</CODE> needs to force the given stream.
 * @param {value} xs - given candidate
 * @returns {boolean} whether <CODE>xs</CODE> is a stream
 */

function is_stream(xs) {
    return is_null(xs) ||
        (is_pair(xs) &&
        is_function(tail(xs)) &&
        arity(tail(xs)) === 0 &&
        is_stream(stream_tail(xs)));
}

/**
 * Given list <CODE>xs</CODE>, returns a stream of same length with
 * the same elements as <CODE>xs</CODE> in the same order.
 * Laziness:  Yes: <CODE>list_to_stream</CODE> 
 * goes down the list only when forced. 
 * @param {list} xs - given list
 * @returns {stream} stream containing all elements of <CODE>xs</CODE>
 */

function list_to_stream(xs) {
    return is_null(xs)
        ? null
        : pair(head(xs),
            () => list_to_stream(tail(xs)));
}

/**
 * Given stream <CODE>xs</CODE>, returns a list of same length with
 * the same elements as <CODE>xs</CODE> in the same order.
 * Laziness:  No: <CODE>stream_to_list</CODE> needs to force the whole 
 * stream.
 * @param {stream} xs - stream
 * @returns {list} containing all elements of <CODE>xs</CODE>
 */

function stream_to_list(xs) {
    return is_null(xs)
        ? null
        : pair(head(xs), stream_to_list(stream_tail(xs)));
}



/**
 * Given <CODE>n</CODE> values, returns a stream of length <CODE>n</CODE>.
 * The elements of the stream are the given values in the given order.
 * Lazy? No: A
 * complete list is generated, 
 * and then a stream using <CODE>list_to_stream</CODE> is generated from it.
 * @param {value} value1,value2,...,value_n - given values
 * @returns {stream} stream containing all values
 */

function stream() {
  var the_list = null
  for (var i = arguments.length - 1; i >= 0; i--) {
    the_list = pair(arguments[i], the_list)
  }
  return list_to_stream(the_list)
}

/**
 * Returns the length of the stream
 * <CODE>xs</CODE>. 
 * Iterative process; time: <CODE>O(n)</CODE>, space:
 * <CODE>O(1)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * Lazy? No: The function needs to explore the whole stream 
 * @param {stream} xs - given stream
 * @returns {number} length of <CODE>xs</CODE>
 */

function stream_length(xs) {
    return is_null(xs)
        ? 0
        : 1 + stream_length(stream_tail(xs));
}

/**
 * Returns a stream that results from stream
 * <CODE>xs</CODE> by element-wise application 
 * of unary function <CODE>f</CODE>. 
 * <CODE>f</CODE> is applied element-by-element:
 * <CODE>stream_map(f, stream(1,2))</CODE> results in
 * the same as <CODE>stream(f(1),f(2))</CODE>.
 * Lazy? Yes: The argument stream is only explored as forced by
 *            the result stream.
 * @param {function} f - unary 
 * @param {stream} xs - given stream
 * @returns {stream} result of mapping
 */
function stream_map(f, s) {
    return is_null(s)
        ? null
        : pair(f(head(s)),
            () => stream_map(f, stream_tail(s)));
}

/** 
 * Makes a stream with <CODE>n</CODE>
 * elements by applying the unary function <CODE>f</CODE>
 * to the numbers 0 to <CODE>n - 1</CODE>, assumed to be a nonnegative integer.
 * Lazy? Yes: The result stream forces the application of <CODE>f</CODE>
 *           for the next element
 * @param {function} f - unary function
 * @param {number} n - given nonnegative integer
 * @returns {stream} resulting stream
 */

function build_stream(fun, n) {
    function build(i) {
        return i >= n
            ? null
            : pair(fun(i),
                () => build(i + 1));
    }
    return build(0);
}


/**
 * Applies unary function <CODE>f</CODE> to every
 * element of the stream <CODE>xs</CODE>.
 * Iterative process; time: <CODE>O(n)</CODE>, space: <CODE>O(1)</CODE>,
 * Where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * <CODE>f</CODE> is applied element-by-element:
 * <CODE>stream_for_each(f, stream(1, 2))</CODE> results in the calls
 * <CODE>f(1)</CODE> and <CODE>f(2)</CODE>.
 * Lazy? No: <CODE>stream_for_each</CODE> 
 * forces the exploration of the entire stream
 * @param {function} f - unary 
 * @param {stream} xs - given stream
 * @returns {boolean} true
 */

function stream_for_each(fun, xs) {
    if (is_null(xs)) {
        return true;
    } else {
        fun(head(xs));
        return stream_for_each(fun, stream_tail(xs));
    }
}

/**
 * Returns stream <CODE>xs</CODE> in reverse
 * order. Iterative process; time: <CODE>O(n)</CODE>,
 * space: <CODE>O(n)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * The process is iterative, but consumes space <CODE>O(n)</CODE>
 * because of the result stream.
 * Lazy? No: <CODE>stream_reverse</CODE> 
 * forces the exploration of the entire stream
 * @param {stream} xs - given stream
 * @returns {stream} <CODE>xs</CODE> in reverse
 */

function stream_reverse(xs) {
    function rev(original, reversed) {
        return is_null(original)
            ? reversed
            : rev(stream_tail(original),
                pair(head(original), () => reversed));
    }
    return rev(xs, null);
}

/**
 * Returns a stream that results from 
 * appending the stream <CODE>ys</CODE> to the stream <CODE>xs</CODE>.
 * In the result, null at the end of the first argument stream
 * is replaced by the second argument, regardless what the second
 * argument consists of.
 * Lazy? Yes: the result stream forces the actual append operation
 * @param {stream} xs - given first stream
 * @param {stream} ys - given second stream
 * @returns {stream} result of appending <CODE>xs</CODE> and <CODE>ys</CODE>
 */

function stream_append(xs, ys) {
    return is_null(xs)
        ? ys
        : pair(head(xs),
            () => stream_append(stream_tail(xs), ys));
}

/**
 * Returns first postfix substream
 * whose head is identical to
 * <CODE>v</CODE> (using <CODE>===</CODE>); returns <CODE>null</CODE> if the
 * element does not occur in the stream.
 * Iterative process; time: <CODE>O(n)</CODE>,
 * space: <CODE>O(1)</CODE>, where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * Lazy? Sort-of: <CODE>stream_member</CODE> 
 * forces the stream only until the element 
 * is found.
 * @param {value} v - given value
 * @param {stream} xs - given stream
 * @returns {stream} postfix substream that starts with <CODE>v</CODE>
 */

function stream_member(x, s) {
    return is_null(s)
        ? null
        : head(s) === x
            ? s
            : stream_member(x, stream_tail(s));
}

/** Returns a stream that results from
 * <CODE>xs</CODE> by removing the first item from <CODE>xs</CODE> that
 * is identical (<CODE>===</CODE>) to <CODE>v</CODE>.
 * Returns the original
 * stream if there is no occurrence. 
 * Lazy? Yes: the result stream forces the construction of each next element
 * @param {value} v - given value
 * @param {stream} xs - given stream
 * @returns {stream} <CODE>xs</CODE> with first occurrence of <CODE>v</CODE> removed
 */

function stream_remove(v, xs) {
    return is_null(xs)
        ? null
        : v === head(xs)
            ? stream_tail(xs)
            : pair(head(xs),
                () => stream_remove(v, stream_tail(xs)));
}

/**
 * Returns a stream that results from
 * <CODE>xs</CODE> by removing all items from <CODE>xs</CODE> that
 * are identical (<CODE>===</CODE>) to <CODE>v</CODE>.
 * Returns the original
 * stream if there is no occurrence.  
 * Recursive process.
 * Lazy? Yes: the result stream forces the construction of each next 
 * element 
 * @param {value} v - given value
 * @param {stream} xs - given stream
 * @returns {stream} <CODE>xs</CODE> with all occurrences of <CODE>v</CODE> removed
 */

function stream_remove_all(v, xs) {
    return is_null(xs)
        ? null
        : v === head(xs)
            ? stream_remove_all(v, stream_tail(xs))
            : pair(head(xs), () => stream_remove_all(v, stream_tail(xs)));
}

/**
 * Returns a stream that contains
 * only those elements of given stream <CODE>xs</CODE>
 * for which the one-argument function
 * <CODE>pred</CODE>
 * returns <CODE>true</CODE>.
 * Lazy? Yes: The result stream forces the construction of
 *            each next element. Of course, the construction
 *            of the next element needs to go down the stream
 *            until an element is found for which <CODE>pred</CODE> holds.
 * @param {function} pred - unary function returning boolean value
 * @param {stream} xs - given stream
 * @returns {stream} stream with those elements of <CODE>xs</CODE> for which <CODE>pred</CODE> holds.
 */

function stream_filter(p, s) {
    return is_null(s)
        ? null
        : p(head(s))
            ? pair(head(s),
                () => stream_filter(p, stream_tail(s)))
            : stream_filter(p, stream_tail(s));
}

/**
 * Returns a stream that enumerates
 * numbers starting from <CODE>start</CODE> using a step size of 1, until
 * the number exceeds (<CODE>&gt;</CODE>) <CODE>end</CODE>.
 * Lazy? Yes: The result stream forces the construction of
 *            each next element
 * @param {number} start - starting number
 * @param {number} end - ending number
 * @returns {stream} stream from <CODE>start</CODE> to <CODE>end</CODE>
 */

function enum_stream(start, end) {
    return start > end
        ? null
        : pair(start,
            () => enum_stream(start + 1, end));
}

/**
 * Returns infinite stream if integers starting 
 * at given number <CODE>n</CODE> using a step size of 1.
 * Lazy? Yes: The result stream forces the construction of
 *            each next element
 * @param {number} start - starting number
 * @returns {stream} infinite stream from <CODE>n</CODE>
 */

function integers_from(n) {
    return pair(n,
        () => integers_from(n + 1));
}

/**
 * Constructs the list of the first <CODE>n</CODE> elements
 * of a given stream <CODE>s</CODE>
 * Lazy? Sort-of: <CODE>eval_stream</CODE> only forces the computation of
 * the first <CODE>n</CODE> elements, and leaves the rest of
 * the stream untouched.
 * @param {stream} s - given stream
 * @param {number} n - nonnegative number of elements to place in result list
 * @returns {list} result list
 */

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

/** 
 * Returns the element
 * of stream <CODE>xs</CODE> at position <CODE>n</CODE>, 
 * where the first element has index 0.
 * Iterative process;
 * time: <CODE>O(n)</CODE>, space: <CODE>O(1)</CODE>,
 * where <CODE>n</CODE> is the length of <CODE>xs</CODE>.
 * Lazy? Sort-of: <CODE>stream_ref</CODE> only forces the computation of
 *                the first <CODE>n</CODE> elements, and leaves the rest of
 *                the stream untouched.
 * @param {stream} xs - given stream
 * @param {number} n - given position
 * @returns {value} item in <CODE>xs</CODE> at position <CODE>n</CODE>
 */

function stream_ref(s, n) {
    return n === 0
        ? head(s)
        : stream_ref(stream_tail(s), n - 1);
}

// \end{lstlisting} // \texttt{stream.js END}
