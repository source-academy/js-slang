////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT PASS
////////////////////////////////////////////////////////////////////////////////
// function simple() {
//     return 1;
// }
// simple();   // returns 1

/* ************ WORKINGS ************
 * 1. Annotate
 * function simple() { (return (1^T18))^T19 }^T20
 * simple^T21()^T22
 * 
 * 2. Type Env
 * simple <- () => T20 ~~> simple <- () => number
 * 
 * 3. Type Constraints
 * T18 = number                     // inferLiteral()
 * T19 = T18 ~~> T19 = number       // inferReturnStatement()
 * T20 = T19 ~~> T20 = number       // inferBlockStatement()
 * 
 * T21 = () => number               // inferIdentifier()
 * T22 = number                     // inferFunctionApplication() - set return type
 * ************/



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect no. of args
////////////////////////////////////////////////////////////////////////////////
// function simple() {
//     return 0;
// }
// simple(3);  // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect usage of func application
////////////////////////////////////////////////////////////////////////////////
// function simple() {
//     return true;
// }
// simple() - 1;   // !! TYPE ERR !!

/* ************ WORKINGS ************
 * 1. Annotate
 * function simple() { (return (true^T18))^T19 }^T20
 * (simple^T21()^T22 - 1^T23)^T24
 * 
 * 2. Type Env
 * simple <- () => T20 ~~> simple <- () => boolean
 * 
 * 3. Type Constraints
 * T18 = boolean                    // inferLiteral()
 * T19 = T18 ~~> T19 = boolean      // inferReturnStatement()
 * T20 = T19 ~~> T20 = boolean      // inferBlockStatement()
 * 
 * T21 = () => boolean              // inferIdentifier()
 * T22 = boolean                    // inferFunctionApplication() - set return type
 * T23 = number                     // inferLiteral()
 * T22 = number ~~> !! TYPE ERR !!  // inferBinaryExpression()
 * ************/



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT PASS
////////////////////////////////////////////////////////////////////////////////
// function identity(x) {
//     return x;
// }
// identity(3);    // returns 3

/* ************ WORKINGS ************
 * 1. Annotate
 * function identity(x^T21) { (return (x^T18))^T19 }^T20
 * identity^T23(3^T22)^T24 
 * 
 * 2. Type Env
 * identity <- (T21) => T20 ~~> identity <- (T21) => T21
 * 
 * 3. Type Constraints
 * T18 = T21                        // inferIdentifier()
 * T19 = T18 ~~> T19 = T21          // inferReturnStatement()
 * T20 = T19 ~~> T20 = T21          // inferBlockStatement()
 * 
 * T22 = number                     // inferLiteral()
 * T23 = (T21) => T21               // inferIdentifier()
 * T22 = T25 ~~> T25 = number       // inferFunctionApplication() - check arg type (w fresh type var)
 * T24 = T25 ~~> T24 = number       // inferFunctionApplication() - set return type
 * ************/



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect usage of func application
////////////////////////////////////////////////////////////////////////////////
// function identity(x) {
//     return x;
// }
// identity(true) - 2;     // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT PASS
////////////////////////////////////////////////////////////////////////////////
// function identity(x) {
//     return x > (x - 1);
// }
// identity(1);    // returns true



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect input to func application
////////////////////////////////////////////////////////////////////////////////
// function identity(x) {
//     return x && (x - 1);
// }
// identity(1);    // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT PASS
////////////////////////////////////////////////////////////////////////////////
// function nested(x) {
//     if (x) {
//         return true;
//     } else {
//         return false;
//     }
// }
// nested(true) && 3;   // returns 3



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect usage of func application
////////////////////////////////////////////////////////////////////////////////
// function nested(x) {
//     if (x) {
//         return true;
//     } else {
//         return false;
//     }
// }
// nested(true) - 3;  // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect input to func application
////////////////////////////////////////////////////////////////////////////////
// function nested(x) {
//     if (x) {
//         return true;
//     } else {
//         return false;
//     }
// }
// nested(1);  // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Inconsistent return types
////////////////////////////////////////////////////////////////////////////////
// function nested(x) {
//     if (x) {
//         return true;
//     } else if (x && x) {
//         return true;
//     } else {
//         return 0;
//     }
// }   // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT PASS
////////////////////////////////////////////////////////////////////////////////
// function multarg(x, y) {
//     if (x && y) {
//         return true;
//     } else {
//         return false;
//     }
// }
// multarg(true, false) && 5;   // returns false



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect no. of args
////////////////////////////////////////////////////////////////////////////////
// function multarg(x, y) {
//     return 0;
// }
// multarg(true);  // !! TYPE ERR !!



////////////////////////////////////////////////////////////////////////////////
// TEST CASE - EXPECT FAIL
// Incorrect input to func application
////////////////////////////////////////////////////////////////////////////////
// function multarg(x, y) {
//     // return (x && y);    // TODO: Unable to check for this type err (for now) as we don't eval output of && operator..
//     return (x > y);
// }
// multarg(true, 3) && 5;  // !! TYPE ERR !!
