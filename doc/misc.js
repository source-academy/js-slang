/**
 * checks whether a given value is a number
 * @param value to be checked
 * @returns {boolean} indicating whether the value is a number
 */
function is_number(v) {
}

export function parse_int(str, radix) {
  if (
    typeof str === 'string' &&
    typeof radix === 'number' &&
    Number.isInteger(radix) &&
    2 <= radix &&
    radix <= 36
  ) {
    return parseInt(str, radix)
  } else {
    throw new Error(
      'parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive.'
    )
  }
}

export function runtime() {
  return new Date().getTime()
}
