var viewport_size = 600

function generateCurve(scaleMode, drawMode, numPoints, func, isFullView) {
  curveColor = t => func(t).getColor()
  const viewport_size = 600
  const frame = open_pixmap('frame', viewport_size, viewport_size, true);
  var curvePosArray = []
  var curveColorArray = []
  var transMat = mat4.create()
  var curveObject = {}
  // initialize the min/max to extreme values
  var min_x = Infinity
  var max_x = -Infinity
  var min_y = Infinity
  var max_y = -Infinity

  function evaluator(num, func) {
    // func should take input of [0, 1] and output pair(x, y)
    // where x,y is in [0, 1]
    // evaluator has a side effect of recording the max/min
    // x and y value for adjusting the position
    curveObject = {}
    curvePosArray = []
    curveColorArray = []
    for (var i = 0; i <= num; i += 1) {
      var point = func(i / num)
      if (
        !(point instanceof Point)
      ) {
        throw 'Expected a point, encountered ' + point
      }
      var x = point.getX() * 2 - 1
      var y = point.getY() * 2 - 1
      curvePosArray.push(x, y)
      var colorArray = curveColor(i / num)
      var color_r = colorArray[0]
      var color_g = colorArray[1]
      var color_b = colorArray[2]
      var color_a = colorArray[3]
      curveColorArray.push(color_r, color_g, color_b, color_a)
      min_x = Math.min(min_x, x)
      max_x = Math.max(max_x, x)
      min_y = Math.min(min_y, y)
      max_y = Math.max(max_y, y)
    }
  }

  evaluator(numPoints, func)

  if (isFullView) {
    var vert_padding = 0.05 * (max_y - min_y)
    min_y -= vert_padding
    max_y += vert_padding
    var horiz_padding = 0.05 * (max_x - min_x)
    min_x -= horiz_padding
    max_x += horiz_padding
  }

  if (scaleMode == 'fit') {
    var center = [(min_x + max_x) / 2, (min_y + max_y) / 2]
    var scale = Math.max(max_x - min_x, max_y - min_y)
    scale = scale === 0 ? 1 : scale;
    mat4.scale(transMat, transMat, vec3.fromValues(2 / scale, 2 / scale, 0))
                                     // use 2 because the value is in [-1, 1]
    mat4.translate(transMat, transMat, vec3.fromValues(-center[0], -center[1], 0))
  } else if (scaleMode == 'stretch') {
    var center = [(min_x + max_x) / 2, (min_y + max_y) / 2]
    var x_scale = max_x === min_x ? 1 : (max_x - min_x)
    var y_scale = max_y === min_y ? 1 : (max_y - min_y)
    mat4.scale(transMat, transMat, vec3.fromValues(2 / x_scale, 2 / y_scale, 0))
                                    // use 2 because the value is in [-1, 1]
    mat4.translate(transMat, transMat, vec3.fromValues(-center[0], -center[1], 0))
  } else {
    // do nothing for normal situations
  }
  clear_viewport()
  gl.uniformMatrix4fv(u_transformMatrix, false, transMat)
  curveObject.curvePos = curvePosArray
  curveObject.color = curveColorArray
  drawCurve(drawMode, curveObject)
  copy_viewport(gl.canvas, frame);
  return new ShapeDrawn(frame);
}

/**
 * returns a function that turns a given Curve into a Drawing, 
 * by sampling the Curve at <CODE>num</CODE> sample points 
 * and connecting each pair with a line. 
 * When a program evaluates to a Drawing, the Source system
 * displays it graphically, in a window, instead of textually.
 * The parts between (0,0) and (1,1) of the resulting Drawing 
 * are shown in the window.
 * @param {Number} num - determines the number of points to be 
 * sampled. Including 0 and 1,
 * there are <CODE>num + 1</CODE> evenly spaced sample points.
 * @return {function} function of type Curve → Drawing
 */
function draw_connected(num) {
  return function(func) {
    return generateCurve('none', 'lines', num, func)
  }
}

/**
 * returns a function that turns a given Curve into a Drawing, 
 * by sampling the Curve at <CODE>num</CODE> sample points.
 * The Drawing consists of isolated points, and does not connect them.
 * When a program evaluates to a Drawing, the Source system
 * displays it graphically, in a window, instead of textually.
 * The parts between (0,0) and (1,1) of the resulting Drawing 
 * are shown in the window.
 * @param {Number} num - determines the number of points to be 
 * sampled. Including 0 and 1,
 * there are <CODE>num + 1</CODE> evenly spaced sample points.
 * @return {function} function of type Curve → Drawing
 */
function draw_points_on(num) {
  return curve => 
	generateCurve('none', 'points', num, curve)
}

/**
 * returns a function that turns a given Curve into a Drawing, 
 * by sampling the Curve at <CODE>num</CODE> sample points.
 * The Drawing consists of isolated points, and does not connect them.
 * When a program evaluates to a Drawing, the Source system
 * displays it graphically, in a window, instead of textually.
 * The Drawing is squeezed such that all its parts are shown in the
 * window.
 * @param {Number} num - determines the number of points to be 
 * sampled. Including 0 and 1,
 * there are <CODE>num + 1</CODE> evenly spaced sample points.
 * @return {function} function of type Curve → Drawing
 */
function draw_points_squeezed_to_window(num) {
  return function(func) {
    return generateCurve('fit', 'points', num, func)
  }
}

/**
 * returns a function that turns a given Curve into a Drawing, 
 * by sampling the Curve at <CODE>num</CODE> sample points 
 * and connecting each pair with a line. 
 * When a program evaluates to a Drawing, the Source system
 * displays it graphically, in a window, instead of textually.
 * The Drawing is resized proportionally such that it 
 * is shown as big as possible, and still fits entirely 
 * inside the window.
 * @param {Number} num - determines the number of points to be 
 * sampled. Including 0 and 1,
 * there are <CODE>num + 1</CODE> evenly spaced sample points.
 * @return {function} function of type Curve → Drawing
 */
function draw_connected_squeezed_to_window(num) {
  return function(func) {
    return generateCurve('fit', 'lines', num, func)
  }
}

/**
 * returns a function that turns a given Curve into a Drawing, 
 * by sampling the Curve at <CODE>num</CODE> sample points 
 * and connecting each pair with a line. 
 * When a program evaluates to a Drawing, the Source system
 * displays it graphically, in a window, instead of textually.
 * The Drawing is stretched or shrunk
 * to show the full curve
 * and maximize its width and height, with some padding.
 * @param {Number} num - determines the number of points to be 
 * sampled. Including 0 and 1,
 * there are <CODE>num + 1</CODE> evenly spaced sample points.
 * @return {function} function of type Curve → Drawing
 */
function draw_connected_full_view(num) {
  return function(func) {
    return generateCurve('stretch', 'lines', num, func, true)
  }
}

/**
 * returns a function that turns a given Curve into a Drawing, 
 * by sampling the Curve at <CODE>num</CODE> sample points 
 * and connecting each pair with a line. 
 * When a program evaluates to a Drawing, the Source system
 * displays it graphically, in a window, instead of textually.
 * The Drawing is scaled proportionally to show the full curve
 * and maximize its size, with some padding.
 * @param {Number} num - determines the number of points to be 
 * sampled. Including 0 and 1,
 * there are <CODE>num + 1</CODE> evenly spaced sample points.
 * @return {function} function of type Curve → Drawing
 */
function draw_connected_full_view_proportional(num) {
  return function(func) {
    return generateCurve('fit', 'lines', num, func, true)
  }
}

/**
 * makes a Point with given x and y coordinates
 * @param {Number} x - x-coordinate of new point
 * @param {Number} y - y-coordinate of new point
 * @returns {Point} with x and y as coordinates
 */
function make_point(x, y) {
  var p = new Point()
  p.setX(x)
  p.setY(y)
  p.setZ(0) //0 as default for 2D curves
  p.setColor([0, 0, 0, 1]) //black as default
  return p
}

/**
 * makes a color Point with given x and y coordinates, 
 * and RGB values ranging from 0 to 255. 
 * Any input lower than 0 will be rounded up to 0, 
 * and any input higher than 255 will be rounded down to 255.
 * @param {Number} x - x-coordinate of new point
 * @param {Number} y - y-coordinate of new point
 * @param {Number} r - red component of new point
 * @param {Number} g - green component of new point
 * @param {Number} b - blue component of new point
 * @returns {Point} with x and y as coordinates, and r, g, and b as RGB values
 */
function make_color_point(x, y, r, g, b){
  var p = new Point()
  p.setX(x)
  p.setY(y)
  p.setZ(0) //0 as default for 2D curves
  p.setColor([r/255, g/255, b/255, 1])
  return p
}

/**
 * retrieves the x-coordinate of a given Point
 * @param {Point} p - given point
 * @returns {Number} x-coordinate of the Point
 */
function x_of(pt) {
  return pt.getX();
}

/**
 * retrieves the y-coordinate of a given Point
 * @param {Point} p - given point
 * @returns {Number} y-coordinate of the Point
 */
function y_of(pt) {
  return pt.getY();
}

/**
 * retrieves the z-coordinate of a given Point
 * @param {Point} p - given point
 * @returns {Number} z-coordinate of the Point
 */
function z_of(pt) {
  return pt.getZ();
}

/**
 * retrieves the red component of a given Point
 * @param {Point} p - given point
 * @returns {Number} Red component of the Point
 */
function r_of(pt) {
  return pt.getColor()[0] * 255;
}

/**
 * retrieves the green component of a given Point
 * @param {Point} p - given point
 * @returns {Number} Green component of the Point
 */
function g_of(pt) {
  return pt.getColor()[1] * 255;
}

/**
 * retrieves the blue component of a given Point
 * @param {Point} p - given point
 * @returns {Number} Blue component of the Point
 */
function b_of(pt) {
  return pt.getColor()[2] * 255;
}