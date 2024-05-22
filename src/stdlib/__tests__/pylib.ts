import { Chapter } from '../../types'
import { expectParsedErrorsToEqual, expectResultsToEqual } from '../../utils/testing'

expectResultsToEqual(
  [
    // Addition
    ['adding two integers is integer', '1 + 2', 3n],
    ['adding two floats is ok', '1.0 + 2.0', 3],
    ['adding integer to float is ok', '1.0 + 2', 3],
    ['adding integer to string is string', '"a" + 1', 'a1'],
    ['adding string to integer is string', '1 + "a"', '1a'],
    ['adding string to string is string', '"a" + "b"', 'ab'],

    // Subtraction
    ['subtracting two integers is integer', '1 - 2', -1n],
    ['subtracting two floats is ok', '1.0 - 2.0', -1],

    // Multiplication
    ['multiplying two integers is ok', '1 * 2', 2n],
    ['multiplying two floats is ok', '1.0 * 2.0', 2],
    ['multiplying integer and float is ok', '1.0 * 2', 2],

    // Division
    ['dividing integer by float is ok', '2 / 1.0', 2],
    ['dividing float by float is ok', '2.0 / 1.0', 2],
    ['dividing integer by integer yields float', '1 / 2', 0.5],

    // Modulo
    ['modulo integer by float is ok', '2 % 1.0', 0],
    ['modulo float by float is ok', '2.0 % 1.0', 0],
    ['modulo integer by integer is integer', '2 % 1', 0n],

    // Exponentiation
    ['exponentiating integer by float is ok', '2 ** 1.0', 2],
    ['exponentiating float by float is ok', '2.0 ** 1.0', 2],
    ['exponentiating integer by integer is integer', '2 ** 1', 2n],

    // Floor Division
    ['integer floor division by float is integer', '2 // 1.0', 2n],
    ['integer floor division by integer is integer', '2 // 1', 2n],
    ['float floor division by float is integer', '2.0 // 1.0', 2n]
  ],
  Chapter.PYTHON_1
)

expectParsedErrorsToEqual(
  [
    [
      'Cannot multiply non-number values',
      'True * 2',
      'Line 1: Error: Expected number on left hand side of operation, got boolean.'
    ],
    [
      'Cannot divide non-number values',
      '"a" / 2',
      'Line 1: Error: Expected number on left hand side of operation, got string.'
    ],
    [
      'Cannot modulo non-number values',
      '"a" % 2',
      'Line 1: Error: Expected number on left hand side of operation, got string.'
    ],
    [
      'Cannot exponentiate non-number values',
      '"a" ** 2',
      'Line 1: Error: Expected number on left hand side of operation, got string.'
    ],
    [
      'Cannot floor divide non-number values',
      '"a" // 2',
      'Line 1: Error: Expected number on left hand side of operation, got string.'
    ]
  ],
  Chapter.PYTHON_1
)
