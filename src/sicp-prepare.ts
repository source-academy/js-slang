import { dict, default as createContext } from "./createContext";
var fs = require('fs');

createContext(4);

let a = Object.getOwnPropertyNames(dict);

var file = fs.createWriteStream('sicp_publish/names.txt');
file.on('error', function(e: Error) {
     console.log(e) 
    }
);

a.forEach(
    function(v) {
        file.write(v + '\n');
    }
);

file.end();

// global.display = dict["display"];
// global.list = dict["list"];
// global.head = dict["head"];
// global.tail = dict["tail"];
