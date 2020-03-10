export const vmPrelude = `
// functions should be sorted by alphabetical order. Refer to SVML spec on wiki

// 0
function accumulate(f, initial, xs) {
  return is_null(xs) ? initial : f(head(xs), accumulate(f, initial, tail(xs)));
}

// 1
function append(xs, ys) {
  return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
}

// 2 placeholder
function array_length(arr) {
    return 0;
}

// 3
function build_list(n, fun) {
  function build(i, fun, already_built) {
    return i < 0 ? already_built : build(i - 1, fun, pair(fun(i), already_built));
  }
  return build(n - 1, fun, null);
}

// 4
function build_stream(n, fun) {
  function build(i) {
    return i >= n
      ? null
      : pair(fun(i),
        () => build(i + 1));
  }
  return build(0);
}

// 5 placeholder
function display(v) {
  return 1;
}

// 6 placeholder
function draw_data(v) {
  return 1;
}

// 7
function enum_list(start, end) {
  return start > end ? null : pair(start, enum_list(start + 1, end));
}

// 8
function enum_stream(start, end) {
  return start > end
    ? null
    : pair(start,
      () => enum_stream(start + 1, end));
}

// 9
function equal(x, y) {
  return is_pair(x) && is_pair(y) ? equal(head(x), head(y)) && equal(tail(x), tail(y)) : x === y;
}

// 10 placeholder
function error(v) {
  return 1;
}

// 11
function eval_stream(s, n) {
  return n === 0
    ? null
    : pair(head(s),
      eval_stream(stream_tail(s),
        n - 1));
}

// 12
function filter(pred, xs) {
  return is_null(xs)
    ? xs
    : pred(head(xs))
    ? pair(head(xs), filter(pred, tail(xs)))
    : filter(pred, tail(xs));
}

// 13
function for_each(fun, xs) {
  if (is_null(xs)) {
    return true;
  } else {
    fun(head(xs));
    return for_each(fun, tail(xs));
  }
}

// 14 unlike Source version, does not fail gracefully
function head(xs) {
  return xs[0];
}

// 15
function integers_from(n) {
  return pair(n,
    () => integers_from(n + 1));
}

// 16 placeholder
function is_array(x) {
  return 1;
}

// 17 placeholder
function is_boolean(x) {
  return 1;
}

// 18 placeholder
function is_function(x) {
  return 1;
}

// 19
function is_list(xs) {
  return is_null(xs) || (is_pair(xs) && is_list(tail(xs)));
}

// 20 placeholder
function is_null(x) {
  return 1;
}

// 21 placeholder
function is_number(x) {
  return 1;
}

// 22 placeholder
function is_pair(x) {
  return 1;
}

// 23
function is_stream(xs) {
  return is_null(xs) || (is_pair(xs) && is_stream(stream_tail(xs)));
}

// 24 placeholder
function is_string(x) {
  return 1;
}

// 25 placeholder
function is_undefined(x) {
  return 1;
}

// 26
function length(xs) {
  return is_null(xs) ? 0 : 1 + length(tail(xs));
}

// 27 placeholder
function list(xs) {
  return 1;
}

// 28
function list_ref(xs, n) {
  return n === 0 ? head(xs) : list_ref(tail(xs), n - 1);
}

// 29
function list_to_stream(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs),
      () => list_to_stream(tail(xs)));
}

// 30
function list_to_string(xs) {
    return is_null(xs)
        ? "null"
        : is_pair(xs)
            ? "[" + list_to_string(head(xs)) + "," +
                list_to_string(tail(xs)) + "]"
            : stringify(xs);
}

// 31
function map(f, xs) {
  return is_null(xs) ? null : pair(f(head(xs)), map(f, tail(xs)));
}

// 32 placeholder
function math_abs(xs) {
  return 1;
}

// 33 placeholder
function math_acos(xs) {
  return 1;
}

// 34 placeholder
function math_acosh(xs) {
  return 1;
}

// 35 placeholder
function math_asin(xs) {
  return 1;
}

// 36 placeholder
function math_asinh(xs) {
  return 1;
}

// 37 placeholder
function math_atan(xs) {
  return 1;
}

// 38 placeholder
function math_atan2(xs) {
  return 1;
}

// 39 placeholder
function math_atanh(xs) {
  return 1;
}

// 40 placeholder
function math_cbrt(xs) {
  return 1;
}

// 41 placeholder
function math_ceil(xs) {
  return 1;
}

// 42 placeholder
function math_clz32(xs) {
  return 1;
}

// 43 placeholder
function math_cos(xs) {
  return 1;
}

// 44 placeholder
function math_cosh(xs) {
  return 1;
}

// 45 placeholder
function math_exp(xs) {
  return 1;
}

// 46 placeholder
function math_expm1(xs) {
  return 1;
}

// 47 placeholder
function math_floor(xs) {
  return 1;
}

// 48 placeholder
function math_fround(xs) {
  return 1;
}

// 49 placeholder
function math_hypot(xs) {
  return 1;
}

// 50 placeholder
function math_imul(xs) {
  return 1;
}

// 51 placeholder
function math_log(xs) {
  return 1;
}

// 52 placeholder
function math_log1p(xs) {
  return 1;
}

// 53 placeholder
function math_log2(xs) {
  return 1;
}

// 54 placeholder
function math_log10(xs) {
  return 1;
}

// 55 placeholder
function math_max(xs) {
  return 1;
}

// 56 placeholder
function math_min(xs) {
  return 1;
}

// 57 placeholder
function math_pow(xs) {
  return 1;
}

// 58 placeholder
function math_random(xs) {
  return 1;
}

// 59 placeholder
function math_round(xs) {
  return 1;
}

// 60 placeholder
function math_sign(xs) {
  return 1;
}

// 61 placeholder
function math_sin(xs) {
  return 1;
}

// 62 placeholder
function math_sinh(xs) {
  return 1;
}

// 63 placeholder
function math_sqrt(xs) {
  return 1;
}

// 64 placeholder
function math_tan(xs) {
  return 1;
}

// 65 placeholder
function math_tanh(xs) {
  return 1;
}

// 66 placeholder
function math_trunc(xs) {
  return 1;
}

// 67
function member(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? xs : member(v, tail(xs));
}

// 68
function pair(x, y) {
  return [x, y];
}

// 69 placeholder
function parse_int(x,y) {
  return 1;
}

// 70
function remove(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? tail(xs) : pair(head(xs), remove(v, tail(xs)));
}

// 71
function remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
    ? remove_all(v, tail(xs))
    : pair(head(xs), remove_all(v, tail(xs)));
}

// 72
function reverse(xs) {
  function rev(original, reversed) {
    return is_null(original) ? reversed : rev(tail(original), pair(head(original), reversed));
  }
  return rev(xs, null);
}

// 73 placeholder
function runtime(x) {
  return 1;
}

// 74 unlike Source version, does not fail gracefully
function set_head(xs,x) {
  xs[0] = x;
  return undefined;
}

// 75 unlike Source version, does not fail gracefully
function set_tail(xs, x) {
  xs[1] = x;
  return undefined;
}

// 76 placeholder
function stream(x,y) {
  return 1;
}

// 77
function stream_append(xs, ys) {
  return is_null(xs)
    ? ys
    : pair(head(xs),
      () => stream_append(stream_tail(xs), ys));
}

// 78
function stream_filter(p, s) {
  return is_null(s)
    ? null
    : p(head(s))
      ? pair(head(s),
        () => stream_filter(p, stream_tail(s)))
      : stream_filter(p, stream_tail(s));
}

// 79
function stream_for_each(fun, xs) {
    if (is_null(xs)) {
      return true;
    } else {
      fun(head(xs));
      return stream_for_each(fun, stream_tail(xs));
    }
}

// 80
function stream_length(xs) {
  return is_null(xs)
    ? 0
    : 1 + stream_length(stream_tail(xs));
}

// 81
function stream_map(f, s) {
  return is_null(s)
    ? null
    : pair(f(head(s)),
      () => stream_map(f, stream_tail(s)));
}

// 82
function stream_member(x, s) {
  return is_null(s)
    ? null
    : head(s) === x
      ? s
      : stream_member(x, stream_tail(s));
}

// 83
function stream_ref(s, n) {
  return n === 0
    ? head(s)
    : stream_ref(stream_tail(s), n - 1);
}

// 84
function stream_remove(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_tail(xs)
      : pair(head(xs),
        () => stream_remove(v, stream_tail(xs)));
}

// 85
function stream_remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_remove_all(v, stream_tail(xs))
      : pair(head(xs), () => stream_remove_all(v, stream_tail(xs)));
}

// 86
function stream_reverse(xs) {
  function rev(original, reversed) {
    return is_null(original)
      ? reversed
      : rev(stream_tail(original),
        pair(head(original), () => reversed));
  }
  return rev(xs, null);
}

// 87 unlike Source version, does not fail gracefully
function stream_tail(xs) {
    return xs();
}

// 88
function stream_to_list(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs), stream_to_list(stream_tail(xs)));
}

// 89 unlike Source version, does not fail gracefully
function tail(xs) {
  return xs[1];
}

// 90 placeholder
function stringify(x) {
  return 1;
}

// hack to make the call to Program easier, just replace the index 92
(() => 0)();
`
