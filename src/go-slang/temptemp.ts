import { GoslangToAstJson } from "./parser";
import { parseFile } from "./ast/ast";
import * as nodes from './ast/nodes'
import { compile } from "./compiler/compiler";


//import { writeFile } from "fs";

// Takes goslang string and converts it to AST in JSON format
let gslang_code = `package main

//import (
//    "fmt"
//)

func GetFoo() {
    var abc = 123;
    //hello := make(chan int, 10)
    test := foo()
    //fmt.Println(test)
}

func foo() int {
    return 0
}`;

// make needs to be defined and implemented like the mutexes and etc, else will crash since undefined!

GoslangToAstJson(gslang_code).then((result) => {
    //console.log(result);
    const parsed_ast:nodes.File = parseFile(result)
    console.log(parsed_ast);
    const compiled_parsed_ast = compile(parsed_ast)
    console.log(compiled_parsed_ast)
});
