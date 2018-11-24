
var fs = require('fs');
var count = require('./count-tokens').count;

var input = "function x()\n{return 1;}\nfunction y()\n{return 1;}\nfunction z()\n{return 10;}";

console.log(count(input));
console.log(count(fs.readFileSync('shouldbe36.js', 'utf8')));
