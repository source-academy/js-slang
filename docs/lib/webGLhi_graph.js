/**
 * this function is a curve: a function from a
 * fraction t to a point. The points lie on the
 * unit circle. They start at Point (1,0) when
 * t is 0. When t is 0.25, they reach Point (0,1),
 * when t is 0.5, they reach Point (-1, 0), etc.
 * 
 * @param {number} t - fraction between 0 and 1
 * @returns {Point} Point in the line at t
 */
function unit_circle(t) {
  return make_point(Math.sin(2 * Math.PI * t),
    Math.cos(2 * Math.PI * t))
}

/**
 * this function is a curve: a function from a
 * fraction t to a point. The x-coordinate at
 * franction t is t, and the y-coordinate is 0.
 * 
 * @param {number} t - fraction between 0 and 1
 * @returns {Point} Point in the line at t
 */
function unit_line(t) {
  return make_point(t, 0)
}

/**
 * this function is a Curve generator: it takes
 * a number and returns a horizontal curve. The number
 * is a y-coordinate, and the Curve generates
 * only points with the given y-coordinate.
 * 
 * @param {number} t - fraction between 0 and 1
 * @returns {Curve} horizontal Curve 
 */
function unit_line_at(y) {
  return function (t) {
    return make_point(t, y)
  }
}

/**
 * this function is a curve: a function from a
 * fraction t to a point. The points lie on the
 * right half of the unit circle. They start at Point (0,1) when
 * t is 0. When t is 0.5, they reach Point (1,0),
 * when t is 1, they reach Point (0, -1).
 * 
 * @param {number} t - fraction between 0 and 1
 * @returns {Point} Point in the line at t
 */
function arc(t) {
  return make_point(Math.sin(Math.PI * t), Math.cos(Math.PI * t))
}

/**
 * this function is a Curve transformation: a function from a
 * Curve to a Curve. The points of the result Curve are
 * the same points as the points of the original Curve, but
 * in reverse: The result Curve applied to 0 is the original Curve
 * applied to 1 and vice versa.
 * 
 * @param {Curve} original - original Curve
 * @returns {Curve} result Curve
 */
function invert(curve) {
  return function (t) {
    return curve(1 - t)
  }
}

/**
 * this function returns a Curve transformation: 
 * It takes an x-value x0, a y-value y0 and a z-value z0, 
 * each with default value of 0, as arguments 
 * and returns a Curve transformation that
 * takes a Curve as argument and returns
 * a new Curve, by translating the original by x0 in x-direction, 
 * y0 in y-direction and z0 in z-direction.
 * 
 * @param {number} x0 - (Optional) x-value
 * @param {number} y0 - (Optional) y-value
 * @param {number} z0 - (Optional) z-value
 * @returns {function} Curve transformation
 */
function translate_curve(x0, y0, z0) {
  return function (curve) {
    var transformation = c => (function (t) {
      x0 = x0 == undefined ? 0 : x0
      y0 = y0 == undefined ? 0 : y0
      z0 = z0 == undefined ? 0 : z0
      var ct = c(t)
      return make_3D_color_point(x0 + x_of(ct), y0 + y_of(ct), z0 + z_of(ct), r_of(ct), g_of(ct), b_of(ct))
    })
    return transformation(curve)
  }
}

/**
 * this function 
 * takes either 1 or 3 angles, a, b and c in radians as parameter and 
 * returns a Curve transformation: 
 * a function that takes a Curve as argument and returns
 * a new Curve, which is the original Curve rotated by the given angle
 * around the z-axis (1 parameter) in counter-clockwise direction, or 
 * the original Curve rotated extrinsically with Euler angles (a, b, c) 
 * about x, y, and z axes (3 parameters).
 * @param {number} a - given angle
 * @param {number} b - (Optional) given angle
 * @param {number} c - (Optional) given angle
 * @returns {unary_Curve_operator} function that takes a Curve and returns a Curve
 */
function rotate_around_origin(theta) {
  var cth = Math.cos(theta)
  var sth = Math.sin(theta)
  return function (curve) {
    return function (t) {
      var ct = curve(t)
      var x = x_of(ct)
      var y = y_of(ct)
      return make_color_point(cth * x - sth * y, sth * x + cth * y, r_of(ct), g_of(ct), b_of(ct))
    }
  }
}

/**
 * this function takes scaling factors <CODE>a</CODE>, <CODE>b</CODE> 
 * and <CODE>c</CODE>, each with default value of 1, as arguments and 
 * returns a Curve transformation that 
 * scales a given Curve by <CODE>a</CODE> in x-direction, <CODE>b</CODE> 
 * in y-direction and <CODE>c</CODE> in z-direction.
 * 
 * @param {number} a - (Optional) scaling factor in x-direction
 * @param {number} b - (Optional) scaling factor in y-direction
 * @param {number} c - (Optional) scaling factor in z-direction
 * @returns {unary_Curve_operator} function that takes a Curve and returns a Curve
 */
function scale_curve(a1, b1, c1) {
  return function (curve) {
    var transformation = c => (function (t) {
      var ct = c(t)
      a1 = a1 == undefined ? 1 : a1
      b1 = b1 == undefined ? 1 : b1
      c1 = c1 == undefined ? 1 : c1
      return make_3D_color_point(a1 * x_of(ct), b1 * y_of(ct), c1 * z_of(ct), r_of(ct), g_of(ct), b_of(ct))
    })
    return transformation(curve)
  }
}

/**
 * this function takes a scaling factor s argument and returns a
 * Curve transformation that
 * scales a given Curve by s in x, y and z direction.
 * 
 * @param {number} s - scaling factor
 * @returns {unary_Curve_operator} function that takes a Curve and returns a Curve
 */
function scale_proportional(s) {
  return scale_curve(s, s, s)
}

/**
 * this function is a Curve transformation: It
 * takes a Curve as argument and returns
 * a new Curve, as follows.
 * A Curve is in <EM>standard position</EM> if it starts at (0,0) ends at (1,0).
 * This function puts the given Curve in standard position by 
 * rigidly translating it so its
 * start Point is at the origin (0,0), then rotating it about the origin to put
 * its endpoint on the x axis, then scaling it to put the endpoint at (1,0).
 * Behavior is unspecified on closed Curves where start-point equal end-point.
 * 
 * @param {Curve} curve - given Curve
 * @returns {Curve} result Curve
 */
function put_in_standard_position(curve) {
  var start_point = curve(0)
  var curve_started_at_origin = translate_curve(-x_of(start_point), -y_of(start_point))(curve)
  var new_end_point = curve_started_at_origin(1)
  var theta = Math.atan2(y_of(new_end_point), x_of(new_end_point))
  var curve_ended_at_x_axis = rotate_around_origin(-theta)(curve_started_at_origin)
  var end_point_on_x_axis = x_of(curve_ended_at_x_axis(1))
  return scale_proportional(1 / end_point_on_x_axis)(curve_ended_at_x_axis)
}

/**
 * this function is a binary Curve operator: It
 * takes two Curves as arguments and returns
 * a new Curve. The two Curves are combined
 * by using the full first Curve for the first portion
 * of the result and by using the full second Curve for the 
 * second portion of the result.
 * The second Curve is not changed, and therefore
 * there might be a big jump in the middle of the
 * result Curve.
 * @param {Curve} curve1 - first Curve
 * @param {Curve} curve2 - second Curve
 * @returns {Curve} result Curve
 */
function connect_rigidly(curve1, curve2) {
  return t => t < 1 / 2 ? curve1(2 * t) : curve2(2 * t - 1)
}

/**
 * this function is a binary Curve operator: It
 * takes two Curves as arguments and returns
 * a new Curve. The two Curves are combined
 * by using the full first Curve for the first portion
 * of the result and by using the full second Curve for the second
 * portion of the result.
 * The second Curve is translated such that its point
 * at fraction 0 is the same as the Point of the first
 * Curve at fraction 1.
 * 
 * @param {Curve} curve1 - first Curve
 * @param {Curve} curve2 - second Curve
 * @returns {Curve} result Curve
 */
function connect_ends(curve1, curve2) {
  const start_point_of_curve2 = curve2(0);
  const end_point_of_curve1 = curve1(1);
  return connect_rigidly(curve1,
    (translate_curve(x_of(end_point_of_curve1) -
      x_of(start_point_of_curve2),
      y_of(end_point_of_curve1) -
      y_of(start_point_of_curve2)))
      (curve2));
}