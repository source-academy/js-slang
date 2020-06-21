/**
 * 
 * The Number value for e, Euler's number,
 * which is approximately 2.718281828459045.
 * @const {number}
 * 
 */
const math_E = 2.718281828459045;


/**
 * 
 * The Number value for the natural logarithm of 10, 
 * which is approximately 2.302585092994046.
 * @const {number}
 * 
 */
const math_LN10 = 2.302585092994046;


/** 
 * The Number value for the natural logarithm of 2, 
 * which is approximately 0.6931471805599453.
 * @const {number}
 * 
 */
const math_LN2 =  0.6931471805599453;

/** 
 * The Number value for the base-10 logarithm of e, 
the base of the natural logarithms; this value is approximately 0.4342944819032518.
 * 
 * <P/>NOTE:
 * The value of math_LOG10E is approximately the reciprocal of the value of math_LN10.
 *
 * @const {number}
 */
const math_LOG10E =  1 / math_LN10;

/** 
 * The Number value for the base-2 logarithm of eℝ, the base of the natural logarithms; 
this value is approximately 1.4426950408889634.
 * 
 * <P/>NOTE:
 * The value of math_LOG2E is approximately the reciprocal of the value of math_LN2.
 *  
 * @const {number}
 */
const math_LOG2E =  1 / math_LN2;

/** 
 * The Number value for π, the ratio of the circumference of a circle to its diameter, 
which is approximately 3.1415926535897932.
 * 
 * 
 * @const {number}
 */
const math_PI = 3.1415926535897932;

/** 
 * The Number value for the square root of 2, which is approximately 1.4142135623730951.
 * 
 * @const {number}
 */
const math_SQRT2 =  1.4142135623730951;

/** 
 * The Number value for the square root of 0.5, which is approximately 0.7071067811865476.
 * 
 * <P/>NOTE:
 * The value of math_SQRT1_2 is approximately the reciprocal of the value of math_SQRT2.
 * @const {number}
 */
const math_SQRT1_2 =  1 / math_SQRT2;

/**
 *
 * computes the absolute value of x; the result has the same magnitude as <CODE>x</CODE> but has positive sign.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} absolute value of <CODE>x</CODE>
*/
function math_abs( x ) {}

/**
 * computes the arc cosine of <CODE>x</CODE>. 
 * The result is expressed in radians and ranges from +0 to +π.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} arc cosine of <CODE>x</CODE>
 */
function math_acos( x )	{}

 
/**
 *
 * computes the inverse hyperbolic cosine of <CODE>x</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} inverse hyperbolic cosine of <CODE>x</CODE>.
 */
function math_acosh( x )	{}

 
/**
 *
 * computes the arc sine of <CODE>x</CODE>. The result is expressed in radians and ranges from -π / 2 to +π / 2.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} arc sine of <CODE>x</CODE>.
 */
function math_asin( x )	{}

 
/**
 *
 * computes the inverse hyperbolic 
 * sine of <CODE>x</CODE>. The result is expressed in radians and ranges from -π / 2 to +π / 2.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} inverse hyperbolic sine of <CODE>x</CODE>
 */
function math_asinh( x )	{}

 
/**
 *
 * computes the arc tangent of <CODE>x</CODE>. The result is expressed in radians and ranges from -π / 2 to +π / 2.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} arc tangent of <CODE>x</CODE>
 */
function math_atan( x )	{}

 
/**
 *
 * computes the inverse hyperbolic tangent of <CODE>x</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} inverse hyperbolic tangent of <CODE>x</CODE>.
 */
function math_atanh( x )	{}

 
/**
 *
 * computes the arc tangent of the quotient <CODE>y</CODE> / <CODE>x</CODE> of the arguments <CODE>y</CODE> and <CODE>x</CODE>, where the signs of <CODE>y</CODE> and <CODE>x</CODE> are used to determine the quadrant of the result. Note that it is intentional and traditional for the two-argument arc tangent function that the argument named <CODE>y</CODE> be first and the argument named <CODE>x</CODE> be second. The result is expressed in radians and ranges from -π to +π.
 * 
 * @param {number} <CODE>y</CODE> - given first number
 * @param {number} <CODE>x</CODE> - given second number
 * @returns {number} arc tangent of <CODE>y</CODE> / <CODE>x</CODE>.
 */
function math_atan2( y, x )	{}

 
/**
 *
 * computes the cube root of <CODE>x</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} cube root of <CODE>x</CODE>.
 */
function math_cbrt( x )	{}

 
/**
 * computes the smallest (closest to -∞) Number value that is not less than <CODE>x</CODE> and is an integer. If <CODE>x</CODE> is already an integer, the result is <CODE>x</CODE>.
 * The value of math_ceil(x) is the same as the value of -math_floor(-x).
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} "ceiling" of the number
 */
function math_ceil( x )	{}

 
/**
 * When math_clz32 is called with one argument <CODE>x</CODE>, the following steps are taken:
 * 
 * Let n be ToUint32(x).
 * Let p be the number of leading zero bits in the 32-bit binary representation of n.
 * Return p.
 *
 * <P/>NOTE:
 * <BR/>If n is 0, p will be 32. If the most significant bit of the 32-bit binary encoding of n is 1, 
 * p will be 0.
 * 
 * @param {number} n - given number
 * @returns {number} p - leading zero bits
 */
function math_clz32( x ) {}


/**
 *
 * Computes the cosine of <CODE>x</CODE>. 
 * The argument is expressed in radians.
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} - cosine of <CODE>x</CODE>
 */
function math_cos( x ) {}

/**
 *
 * computes the hyperbolic cosine of <CODE>x</CODE>.
 * <P/>NOTE:
 * The value of cosh(x) is the same as (exp(x) + exp(-x)) / 2.
 * @param { number } <CODE>x</CODE> - given number
 * @returns {number} hyperbolic cosine of <CODE>x</CODE>
 */
function math_cosh( x )	{}

 
/**
 * computes the exponential function of <CODE>x</CODE> 
 * (e raised to the power of <CODE>x</CODE>, where e is the base of the natural logarithms).
 * 
 * @param { number } <CODE>x</CODE> - given number
 * @returns {number} e to the power of <CODE>x</CODE>
 */
function math_exp( x )	{}

 
/**
 * computes subtracting 1 from the 
 * exponential function of <CODE>x</CODE> (e raised to the power of <CODE>x</CODE>, where e is the base of 
 * the natural logarithms). The result is computed in a way that is accurate even 
 * when the value of <CODE>x</CODE> is close to 0.
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} -1 plus e to the power of <CODE>x</CODE>
 */
function math_expm1( x )	{}

 
/**
 * computes the greatest (closest to +∞) Number value that is not greater than <CODE>x</CODE> 
 * and is an integer. 
 * <BR/>If <CODE>x</CODE> is already an integer, the result is <CODE>x</CODE>.
 * 
 * <P/>NOTE:
 * The value of math_floor(x) is the same as the value of -math_ceil(-x).
 * @param {number} <CODE>x</CODE> - given number
 * @return {number} floor of <CODE>x</CODE>
 */
function math_floor( x )	{}

 
/**
 *
 * When math_fround is called with argument <CODE>x</CODE>, the following steps are taken:
 * 
 * <OL><LI>If <CODE>x</CODE> is NaN, return NaN.</LI>
 * <LI>If <CODE>x</CODE> is one of +0, -0, +∞, -∞, return <CODE>x</CODE>.</LI>
 * <LI>Let x32 be the result of converting <CODE>x</CODE> to a value in IEEE 754-2008 binary32 format using roundTiesToEven mode.</LI>
 * <LI>Let x64 be the result of converting x32 to a value in IEEE 754-2008 binary64 format.</LI>
 * <LI>Return the ECMAScript Number value corresponding to x64.</LI></OL>
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} fround of <CODE>x</CODE>
 */
function math_fround( x )	{}

/**
 * 
 * computes the square root
 * of the sum of squares of its arguments.
 * 
 * <BR/>If no arguments are passed, the result is +0.
 * @param {number} value1,value2,... - given numbers
 * @returns {number} square root of sum of squares of arguments
 */
function math_hypot ( value1, value2, ...values ) {}
 
/**
 *
 * When math_imul is called with arguments <CODE>x</CODE> and <CODE>y</CODE>,
 * the following steps are taken:
 * <OL>
 * <LI>Let a be ToUint32(x).</LI>
 * <LI>Let b be ToUint32(y).</LI>
 * <LI>Let product be (a × b) modulo 2<SUP>32</SUP>.</LI>
 * <LI>If product ≥ 2<SUP>31</SUP>, return product - 2<SUP>32</SUP>; otherwise return product.</LI></OL>
 * @param {number} <CODE>x</CODE> - given first number
 * @param {number} <CODE>x</CODE> - given second number
 * @returns {number} - <CODE>x</CODE> imul y
 */
function math_imul( x, y ) {}

 
/**
 *
 * Computes the natural logarithm of <CODE>x</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} - natural logarithm of <CODE>x</CODE>
 */
function math_log ( x ) {}

 
/**
 * computes the natural logarithm of 1 + <CODE>x</CODE>. The result is computed in a way that is accurate even when the value of <CODE>x</CODE> is close to zero.
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} math_log(1 + x)
 */
function math_log1p( x )	{}

 
/**
 *
 * computes the base 10 logarithm of <CODE>x</CODE>.
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} base 10 logarithm of <CODE>x</CODE>
 */
function math_log10( x )	{}

 
/**
 *
 * computes the base 2 logarithm of <CODE>x</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - given number
 * @returns {number} base 2 logarithm of <CODE>x</CODE>
 */
function math_log2( x )	{}

 
/**
 *
 * Given zero or more numbers, returns the largest of them.
 * 
 * <BR/>If no arguments are given, the result is -∞.
 * <BR/>If any value is NaN, the result is NaN.
 * The comparison of values to determine the largest value is done using the 
 * Abstract Relational Comparison algorithm except that +0 is considered to be larger than -0.
 * @param {number} value1,value2,... - given numbers
 * @returns {number} largest of them
 */
function math_max( value1, value2, ...values )	{}
 
/**
 *
 * Given zero or more arguments, returns the smallest of them.
 * 
 * <BR/>If no arguments are given, the result is +∞.
 * <BR/>If any value is NaN, the result is NaN.
 * The comparison of values to determine the smallest value is done using the 
 * Abstract Relational Comparison algorithm except that +0 is considered to be larger than -0.
 * @param {number} value1,value2,... - given numbers
 * @returns {number} smallest of them
 */
function math_min( value1, value2, ...values )	{}
 
/**
 *
 * Computes the result of raising base to 
 * the power of exponent.
 * 
 * @param {number} base - the given base
 * @param {number} exponent - the given exponent
 * @returns {number} <CODE>base</CODE> to the power of <CODE>exponent</CODE>
 **/
function math_pow( base, exponent )	{}

 /** 
 * Returns a number value with positive sign, greater than or equal to 0 but less than 1, 
 * chosen randomly or pseudo randomly with approximately uniform distribution over that 
 * range, using an implementation-dependent algorithm or strategy. This function takes no arguments.
 * 
 * Each math_random function created for distinct realms must produce a distinct sequence 
 * of values from successive calls.
 * @returns {number} random number greater than or equal to 0 but less than 1
 */
function math_random ( ) {}
 
/**
 *
 * Returns the number value that is closest to <CODE>x</CODE> and is an integer. 
 * <BR/>If two integers are equally close to <CODE>x</CODE>, then the result is the Number value 
 * that is closer to +∞. If <CODE>x</CODE> is already an integer, the result is <CODE>x</CODE>.
 * 
 * NOTE 1:
 * math_round(3.5) returns 4, but math_round(-3.5) returns -3.
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} closest integer to <CODE>x</CODE>
 */
function math_round( x )	{}

 
/**
 *
 * Computes the sign of <CODE>x</CODE>, indicating whether <CODE>x</CODE> is positive, negative, or zero.
 * 
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the sign (-1, 0 or +1)
 */
function math_sign( x )	{}
 
/**
 *
 * Computes the sine of <CODE>x</CODE>. 
 * The argument is expressed in radians.
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the sine of <CODE>x</CODE>
 */
function math_sin( x )	{}

 
/**
 *
 * Computes the hyperbolic sine of <CODE>x</CODE>.
 * <P/>NOTE:
 * The value of sinh(x) is the same as (exp(x) - exp(-x)) / 2.
 * 
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the hyperbolic sine of <CODE>x</CODE>
 */
function math_sinh( x )	{}

 
/**
 *
 * Computes the square root of <CODE>x</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the square root of <CODE>x</CODE>
 */
function math_sqrt( x )	{}

 
/**
 *
 * Computes the tangent of <CODE>x</CODE>. The argument is expressed in radians.
 * 
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the tangent of <CODE>x</CODE>
 */
function math_tan( x )	{}

 
/**
 *
 * Computes the hyperbolic tangent of <CODE>x</CODE>.
 * 
 * <P/>NOTE:
 * The value of <CODE>math_tanh(x)</CODE> is the same as
 * <CODE>(exp(x) - exp(-x))/(exp(x) + exp(-x))</CODE>.
 * 
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the hyperbolic tangent of <CODE>x</CODE>
 */
function math_tanh( x )	{}

 
/**
 *
 * Computes the integral part of the number <CODE>x</CODE>,
 * removing any fractional digits. 
 * @param {number} <CODE>x</CODE> - the given number
 * @returns {number} the integral part of <CODE>x</CODE>
 */
function math_trunc( x ) {}
