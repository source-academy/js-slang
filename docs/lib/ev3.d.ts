/**
 * Checks if the peripheral is connected.
 *
 * @param {peripheral} obj - The peripheral to check.
 * @returns {boolean} true if the peripheral is connected, false otherwise
 * @alias ev3_connected
 */
declare function connected(obj: peripheral): boolean;
/**
 * Gets the motor connected to port A.
 *
 * @returns {peripheral} The motor connected to port A
 * @alias ev3_motorA
 */
declare function motorA(): peripheral;
/**
 * Gets the motor connected to port B.
 *
 * @returns {peripheral} The motor connected to port B
 * @alias ev3_motorB
 */
declare function motorB(): peripheral;
/**
 * Gets the motor connected to port C.
 *
 * @returns {peripheral} The motor connected to port C
 * @alias ev3_motorC
 */
declare function motorC(): peripheral;
/**
 * Gets the motor connected to port D.
 *
 * @returns {peripheral} The motor connected to port D
 * @alias ev3_motorD
 */
declare function motorD(): peripheral;
/**
 * Causes the motor to rotate for a specified duration at the specified speed.
 *
 * Note: this works by sending instructions to the motors. This will return almost immediately, without waiting for the motor to actually run for the specified duration. If you wish to wait, use {@link ev3_pause}.
 *
 * @param {peripheral} motor - The motor
 * @param {number} time - The duration to turn, in milliseconds
 * @param {number} speed - The speed to run at, in tacho counts per second
 * @alias ev3_runForTime
 */
declare function runForTime(motor: peripheral, time: number, speed: number): void;
/**
 * Causes the motor to rotate to the given absolute position (as reported by
 * {@link ev3_motorGetPosition}) with the given speed.
 *
 * Note: this works by sending instructions to the motors. This will return almost immediately, without waiting for the motor to reach the given absolute position. If you wish to wait, use {@link ev3_pause}.
 *
 * @param {peripheral} motor - The motor
 * @param {number} position - The absolute position to turn to
 * @param {number} speed - The speed to run at, in tacho counts per second
 * @alias ev3_runToAbsolutePosition
 */
declare function runToAbsolutePosition(motor: peripheral, position: number, speed: number): void;
/**
 * Causes the motor to rotate until the position reaches <code>{@link ev3_motorGetPosition}()
 *  + position</code> with the given speed.
 *
 * Note: this works by sending instructions to the motors. This will return almost immediately, without waiting for the motor to reach the given absolute position. If you wish to wait, use {@link ev3_pause}.
 *
 * @param {peripheral} motor - The motor
 * @param {number} position - The amount to turn
 * @param {number} speed - The speed to run at, in tacho counts per second
 * @alias ev3_runToRelativePosition
 */
declare function runToRelativePosition(motor: peripheral, position: number, speed: number): void;
/**
 * Gets the motor's current position, in pulses of the rotary encoder.
 *
 * @param {peripheral} motor - The motor
 * @returns {number} The current position.
 * @alias ev3_motorGetPosition
 */
declare function motorGetPosition(motor: peripheral): number;
/**
 * Gets the motor's current speed, in tacho counts per second.
 *
 * @param {peripheral} motor - The motor
 * @returns {number} The current speed.
 * @alias ev3_motorGetSpeed
 */
declare function motorGetSpeed(motor: peripheral): number;
/**
 * Sets the speed the motor will run at the next time {@link ev3_motorStart}
 * is called.
 *
 * @param {peripheral} motor - The motor
 * @param {number} speed - The speed to run at, in tacho counts per second
 * @alias ev3_motorSetSpeed
 */
declare function motorSetSpeed(motor: peripheral, speed: number): void;
/**
 * Causes the motor to start with the previously set speed and stop action
 * (see {@link motorSetSpeed} and {@link motorSetStopAction}).
 *
 * @param {peripheral} motor - The motor
 * @alias ev3_motorStart
 */
declare function motorStart(motor: peripheral): void;
/**
 * Causes the motor to stop using the previously set stop action.
 *
 * @param {peripheral} motor - The motor
 * @alias ev3_motorStop
 */
declare function motorStop(motor: peripheral): void;
/**
 * Sets the stop action of the motor.
 *
 * Possible stop actions are:
 *
 * <ul><li><code>"coast"</code>: power will be removed from the motor and it will freely coast to a stop.</li>
 * <li><code>"brake"</code>: power will be removed from the motor and a passive electrical load will be placed on the motor. This load will absorb the energy from the rotation of the motors and cause the motor to stop more quickly than coasting.</li>
 * <li><code>"hold"</code>: actively try to hold the motor at the current position. If an external force tries to turn the motor, the motor will ‘push back’ to maintain its position.</li></ul>
 *
 * @param {peripheral} motor - The motor.
 * @param {string} stopAction - The stop action to use.
 * @alias ev3_motorSetStopAction
 */
declare function motorSetStopAction(motor: peripheral, stopAction: string): void;
/**
 * Gets the colour sensor connected any of ports 1, 2, 3 or 4.
 *
 * @returns {peripheral} The colour sensor.
 * @alias ev3_colorSensor
 */
declare function colorSensor(): peripheral;
/**
 * Gets the amount of red seen by the colour sensor.
 *
 * @param {peripheral} colorSensor - The colour sensor.
 * @returns {number} The amount of red, in sensor-specific units.
 * @alias ev3_colorSensorRed
 */
declare function colorSensorRed(colorSensor: peripheral): number;
/**
 * Gets the amount of green seen by the colour sensor.
 *
 * @param {peripheral} colorSensor - The colour sensor.
 * @returns {number} The amount of green, in sensor-specific units.
 * @alias ev3_colorSensorGreen
 */
declare function colorSensorGreen(colorSensor: peripheral): number;
/**
 * Gets the amount of blue seen by the colour sensor.
 *
 * @param {peripheral} colorSensor - The colour sensor.
 * @returns {number} The amount of blue, in sensor-specific units.
 * @alias ev3_colorSensorBlue
 */
declare function colorSensorBlue(colorSensor: peripheral): number;
/**
 * Gets the colour as seen by the colour sensor.
 *
 * Possible colour return values are:
 * <ul><li>0 none</li>
 * <li>1 black</li>
 * <li>2 blue</li>
 * <li>3 green</li>
 * <li>4 yellow</li>
 * <li>5 red</li>
 * <li>6 white</li>
 * <li>7 brown</li></ul>
 *
 * @param {peripheral} colorSensor - The colour sensor.
 * @returns {number} A number representing the colour observed by the device.
 * @alias ev3_colorSensorGetColor
 */
declare function colorSensorGetColor(colorSensor: peripheral): number;
/**
 * Gets the reflected light intensity seen by the colour sensor.
 *
 * @param {peripheral} colorSensor - The colour sensor.
 * @returns {number} The reflected light intensity, as a percentage from 0 to 100.
 * @alias ev3_reflectedLightIntensity
 */
declare function reflectedLightIntensity(colorSensor: peripheral): number;
/**
 * Gets the ambient light intensity seen by the colour sensor.
 *
 * @param {peripheral} colorSensor - The colour sensor.
 * @returns {number} The ambient light intensity, as a percentage from 0 to 100.
 * @alias ev3_ambientLightIntensity
 */
declare function ambientLightIntensity(colorSensor: peripheral): number;
/**
 * Gets the touch sensor connected to port 1.
 *
 * @returns {peripheral} The touch sensor.
 * @alias ev3_touchSensor1
 */
declare function touchSensor1(): peripheral;
/**
 * Gets the touch sensor connected to port 2.
 *
 * @returns {peripheral} The touch sensor.
 * @alias ev3_touchSensor2
 */
declare function touchSensor2(): peripheral;
/**
 * Gets the touch sensor connected to port 3.
 *
 * @returns {peripheral} The touch sensor.
 * @alias ev3_touchSensor3
 */
declare function touchSensor3(): peripheral;
/**
 * Gets the touch sensor connected to port 4.
 *
 * @returns {peripheral} The touch sensor.
 * @alias ev3_touchSensor4
 */
declare function touchSensor4(): peripheral;
/**
 * Gets whether the touch sensor is pressed.
 *
 * @param {peripheral} touchSensor - The touch sensor.
 * @returns {boolean} true when the touch sensor is pressed, false otherwise.
 * @alias ev3_touchSensorPressed
 */
declare function touchSensorPressed(touchSensor: peripheral): boolean;
/**
 * Gets the ultrasonic sensor connected any of ports 1, 2, 3 or 4.
 *
 * @returns {peripheral} The ultrasonic sensor.
 * @alias ev3_ultrasonicSensor
 */
declare function ultrasonicSensor(): peripheral;
/**
 * Gets the distance read by the ultrasonic sensor in centimeters.
 *
 * @param {peripheral} ultrasonicSensor - The ultrasonic sensor.
 * @returns {number} The distance, in centimeters.
 * @alias ev3_ultrasonicSensorDistance
 */
declare function ultrasonicSensorDistance(ultrasonicSensor: peripheral): number;
/**
 * Gets the gyro sensor connected any of ports 1, 2, 3 or 4.
 *
 * @returns {peripheral} The gyro sensor.
 * @alias ev3_gyroSensor
 */
declare function gyroSensor(): peripheral;
/**
 * Gets the rate of rotation detected by the gyro sensor.
 *
 * @param {peripheral} gyroSensor - The gyro sensor.
 * @returns {number} The rate of rotation, in degrees per second.
 * @alias ev3_gyroSensorRate
 */
declare function gyroSensorRate(gyroSensor: peripheral): number;
/**
 * Gets the absolute angle detected by the gyro sensor, measured from when
 * the sensor was last switched to angle mode from sensor rate mode.
 *
 * @param {peripheral} gyroSensor - The gyro sensor.
 * @returns {number} The angle, in degrees.
 * @alias ev3_gyroSensorAngle
 */
declare function gyroSensorAngle(gyroSensor: peripheral): number;
/**
 * Pauses for a period of time.
 *
 * @param {number} time - The time to wait, in milliseconds.
 * @alias ev3_pause
 */
declare function pause(time: number): void;
/**
 * Returns a hello world message.
 *
 * @returns {string} A hello world message.
 * @alias ev3_hello
 */
declare function hello(): string;
/**
 * Waits for one of the buttons on the EV3's control face to be pressed, then
 * returns a value corresponding to the button that was pressed:
 *
 * <ul><li>0 enter (the middle button)</li>
 * <li>1 back (the top left button)</li>
 * <li>2 left</li>
 * <li>3 right</li>
 * <li>4 up</li>
 * <li>5 down</li></ul>
 *
 * @returns {number} A number corresponding to the button that was pressed
 * @alias ev3_waitForButtonPress
 */
declare function waitForButtonPress(): number;
/**
 * Makes the robot speak the given words through its speaker. Returns after the
 * words are spoken.
 *
 * @param {string} words - The words to speak.
 * @alias ev3_speak
 */
declare function speak(words: string): void;
/**
 * Causes the robot to emit a sequence of beeps. Returns after the beeps are
 * emitted.
 *
 * The beep sequence is an array of <code>[frequency, length (ms), delay (ms),
 * ...]</code>. For example, <code>[1000, 500, 500, 250, 500, 0]</code> will
 * cause the robot to emit a 1000 Hz beep for 500 ms, wait 500 ms, then emit a
 * 250 Hz beep for 500 ms.
 *
 * @param {Array} beeps - The beep sequence.
 * @alias ev3_playSequence
 */
declare function playSequence(beeps: any[]): void;
/**
 * Gets the left green LED.
 *
 * Note that the four LEDs on the EV3 are laid out in two pairs of green and
 * red. If both in a pair are turned on, you can vary the colours in a small
 * spectrum between red and green.
 *
 * @returns {peripheral} The left green LED
 * @alias ev3_ledLeftGreen
 */
declare function ledLeftGreen(): peripheral;
/**
 * Gets the left red LED.
 *
 * Note that the four LEDs on the EV3 are laid out in two pairs of green and
 * red. If both in a pair are turned on, you can vary the colours in a small
 * spectrum between red and green.
 *
 * @returns {peripheral} The left red LED
 * @alias ev3_ledLeftRed
 */
declare function ledLeftRed(): peripheral;
/**
 * Gets the right green LED.
 *
 * Note that the four LEDs on the EV3 are laid out in two pairs of green and
 * red. If both in a pair are turned on, you can vary the colours in a small
 * spectrum between red and green.
 *
 * @returns {peripheral} The right green LED
 * @alias ev3_ledRightGreen
 */
declare function ledRightGreen(): peripheral;
/**
 * Gets the right red LED.
 *
 * Note that the four LEDs on the EV3 are laid out in two pairs of green and
 * red. If both in a pair are turned on, you can vary the colours in a small
 * spectrum between red and green.
 *
 * @returns {peripheral} The right red LED
 * @alias ev3_ledRightRed
 */
declare function ledRightRed(): peripheral;
/**
 * Gets the brightness of the given LED.
 *
 * The brightness is a number ranging from 0 (off) to 255 (maximum).
 *
 * @param {peripheral} led - The LED
 * @returns {number} The brightness of the given LED
 * @alias ev3_ledGetBrightness
 */
declare function ledGetBrightness(led: peripheral): number;
/**
 * Sets the brightness of the given LED.
 *
 * The brightness is a number ranging from 0 (off) to 255 (maximum).
 *
 * @param {peripheral} led - The LED
 * @param {number} brightness - The desired brightness
 * @alias ev3_ledSetBrightness
 */
declare function ledSetBrightness(led: peripheral, brightness: number): void;
