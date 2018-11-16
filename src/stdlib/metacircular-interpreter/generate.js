/*
 * Generate.js
 * Joel Low
 *
 * Generates source files from template files.
 */

var fs = require('fs'),
	gcc = require('gcc-rest'),
	http = require('http'),
	Jison = require('jison'),
	Mark = require('markup-js/src/markup'),
	zip = require('node-zip'),
	nomnom = require('nomnom'),
	IO = require('./lib/util/io');

//Constants
var jqueryLatestPath = '/jquery-latest.js';
var jqueryLatestMinPath = '/jquery-latest.min.js';
var jqueryLatestUrl = 'http://code.jquery.com' + jqueryLatestPath;

//Set Closure Compiler parameters
gcc.params({
	output_info      : ['compiled_code', 'errors', 'warnings', 'statistics'],
	language         : 'ECMASCRIPT5',
	compilation_level: 'ADVANCED_OPTIMIZATIONS',
	warning_level    : 'VERBOSE',
	externs_url      : jqueryLatestUrl
});

//Replace code before compiling
gcc.replace(/'use strict';/g, '');

nomnom.script('generate').
	option('environment', {
		flag: true,
		help: 'Generates the JavaScript source files for developing this ' +
		      'distribution from the templates.'
	}).
	option('package', {
		help: 'Generates a source distribution for students, with JediScript ' +
		      'week WEEK support.',
		metavar: 'WEEK'
	}).
	option('interpreter', {
		help: 'Generates just the interpreter script, with JediScript week WEEK ' +
		      'support. This is to generate a script for publishing within ' +
			  'JFDI\'s CodeEval framework',
		metavar: 'WEEK'
	}).
	option('debug', {
		help: 'Used together with --package to generate the distribution ' +
		      'without minifying the output.',
		flag: true
	}).
	option('native', {
		help: 'Used together with --package to generate packages which only ' +
		      'do syntax checking on input.',
		flag: true
	}).
	option('without_jquery', {
		help: 'Excludes jQuery from the package, use this if jQuery will be ' +
		      'provided by other means.',
		flag: true
	});

exports.main = function() {
	args = nomnom.parse();
	if (args.environment) {
		generateEnvironment();
	} else if (args.package) {
		generatePackage(args.package, args.debug, args.native, args.without_jquery);
	} else if (args.interpreter) {
		generateInterpreter(args.interpreter, args.debug, args.native, args.without_jquery);
	} else {
		console.error("No operation specified.");
		console.error(nomnom.getUsage());
		IO.exit(1);
	}
}

/**
 * Renders a given template.
 * 
 * @param string source The path to the template file, relative to the current
 *                      working directory.
 * @param object context An object containing the variables used in the template.
 * @return string The rendered template file.
 */
function renderTemplate(source, context) {
	var template = IO.read(IO.join(IO.cwd(), source));
	return Mark.up(template, context);
}

/**
 * Renders a given template to file.
 * 
 * @param string source The path to the template file, relative to the current
 *                      working directory.
 * @param string dest The path where the rendered template will be saved,
 *                    relative to the current working directory.
 * @param object context An object containing the variables used in the template.
 */
function renderTemplateToFile(source, dest, context) {
	IO.write(IO.join(IO.cwd(), dest), renderTemplate(source, context));
}

function generateEnvironment() {
	var maxWeek = 15;
	
	//First generate the parser for the given week.
	console.log("Generating parser...");
	var parserRendered = renderTemplate("lib/interpreter/parser.jison.tpl", {
		week: maxWeek
	});
	IO.write(IO.join(IO.cwd(), "lib/interpreter/parser.jison"), parserRendered);
	var generator = new Jison.Generator(parserRendered, {});
	IO.write(IO.join(IO.cwd(), "lib/interpreter/parser.js"), generator.generate());

	//Generate the list library for the given week.
	// console.log("Generating list library...");
	// renderTemplateToFile("../list.js.tpl", "../list.js", {
	// 	week: maxWeek
	// });

	// //Generate the object-oriented programming library
	// console.log("Generating Object-Oriented Programming library...");
	// renderTemplateToFile("../object.js.tpl", "../object.js", {
	// 	week: maxWeek
	// });

	// //Generate the streams library
	// console.log("Generating streams library...");
	// renderTemplateToFile("../stream.js.tpl", "../stream.js", {
	// 	week: maxWeek
	// });

	// //Generate the exports
	// console.log("Generating exports...");
	// renderTemplateToFile("lib/exports.js.tpl", "lib/exports.js", {
	// 	week: maxWeek
	// });
}

function generateInterpreter(week, debug, native, without_jquery, writeBack) {
	//Our default write-out
	if (!writeBack) {
		writeBack = function(code) {
			//Merge jQuery with the rest of our code.
			code =
				(without_jquery ? '' : IO.read(IO.join(IO.cwd(), ".tmp/jquery.js")) + "\n\n") +
				code;

			//Build our basename.
			var basename = "jediscript-week-" + week;
			
			//And write-out
			IO.write(IO.join(IO.cwd(), basename + ".js"), code);
		}
	}
	
	//Create our temporary and output folders
	function mkdir(path) {
    console.log(path);
		try {
			fs.statSync(IO.join(IO.cwd(), path));
		} catch (Exception) {
			fs.mkdir(IO.join(IO.cwd(), path));
		}
	}
	mkdir(".tmp");
	mkdir("out");
	mkdir("out/lib");

	//First generate the parser for the given week.
	console.log("Generating parser...");
	var parserRendered = renderTemplate("lib/interpreter/parser.jison.tpl", {
		week: week
	});
	IO.write(IO.join(IO.cwd(), ".tmp/parser.js.jison"), parserRendered);
	var generator = new Jison.Generator(parserRendered, {});
	IO.write(IO.join(IO.cwd(), ".tmp/parser.js"), generator.generate());

	//Generate the list library for the given week.
	// console.log("Generating list library...");
	// renderTemplateToFile("../list.js.tpl", ".tmp/list.js", {
	// 	week: week
	// });

	// //Generate the object-oriented programming library
	// console.log("Generating Object-Oriented Programming library...");
	// renderTemplateToFile("../object.js.tpl", ".tmp/object.js", {
	// 	week: week
	// });

	// //Generate the streams library
	// console.log("Generating streams library...");
	// renderTemplateToFile("../stream.js.tpl", ".tmp/stream.js", {
	// 	week: week
	// });

	//Generate the exports
	// console.log("Generating exports...");
	// renderTemplateToFile("lib/exports.js.tpl", ".tmp/exports.js", {
	// 	week: week
	// });

	//Generate the JediScript thunk library
	console.log("Generating bridge...");
	if (!without_jquery) {
		renderTemplateToFile("lib/jediscript.js.tpl", ".tmp/jediscript.js", {
			week: week,
			native: native
		});
	} else {
		IO.write(IO.join(IO.cwd(), ".tmp/jediscript.js"), "");
	}

	//And get jQuery
	if (without_jquery === undefined || !without_jquery) {
		console.log("Downloading jQuery...");

		var options = {
		  hostname: 'code.jquery.com',
		  port: 80,
		  path: debug ? jqueryLatestPath : jqueryLatestMinPath,
		  method: 'GET'
		};   

		http.get(options, function(res) {
			var jquery = "";
			res.on("data", function(chunk) {
				jquery += chunk;
			});
			res.on("end", function() {
				IO.write(IO.join(IO.cwd(), ".tmp/jquery.js"), jquery);

				//Indicate the version of jQuery we linked against
				var jqueryVersion = / jQuery .*v([0-9.]+)( |$)/im.exec(jquery)[1];
				if (!jqueryVersion) {
					console.error("Unknown download: jQuery version could not be " +
						"determined.");
					IO.exit(1);
				}
				console.log("Using downloaded jQuery " + jqueryVersion + ".");
				gcc.header("// This file was compiled using Google Closure Compiler\n" +
					"// and linked against jQuery v" + jqueryVersion + "\n");
				compilePackage();
			});
		}).on("error", function(e) {
			console.error("Could not download jQuery: " + e.message);
		});
	} else {
		gcc.header("// This file was compiled using Google Closure Compiler\n");
		IO.write(IO.join(IO.cwd(), ".tmp/jquery.js"), "");
		compilePackage();
	}

	//Callback function for after jQuery has been downloaded.
	function compilePackage() {
		if (debug) {
			var combined = '';
			var concatOutput = function(path) {
				return '//---------------------------------------------------' +
						'--------------\n//From file: ' + path + '\n\n' +
					IO.read(path) + '\n';
			};
			
// 			combined += concatOutput(IO.join(IO.cwd(), ".tmp/list.js"));
// 			combined += concatOutput(IO.join(IO.cwd(), "../misc.js"));
// 
// 			combined += concatOutput(IO.join(IO.cwd(), ".tmp/object.js"));
// 			combined += concatOutput(IO.join(IO.cwd(), ".tmp/stream.js"));

			combined += concatOutput(IO.join(IO.cwd(), "lib/interpreter/json2.js"));
			combined += concatOutput(IO.join(IO.cwd(), ".tmp/parser.js"));
			combined += concatOutput(IO.join(IO.cwd(), "lib/interpreter/interpreter.js"));
			combined += concatOutput(IO.join(IO.cwd(), ".tmp/jediscript.js"));

			//Prevent these symbols from being renamed
			combined += concatOutput(IO.join(IO.cwd(), ".tmp/exports.js"));
			writeBack(combined);
		} else {
			console.log("Compiling using the Google Closure Compiler...");

			//Compile using Google Closure:
			//Include the required libraries for functionality.
			// gcc.addFile(IO.join(IO.cwd(), ".tmp/list.js"));
			// gcc.addFile(IO.join(IO.cwd(), "../misc.js"));

			// gcc.addFile(IO.join(IO.cwd(), ".tmp/object.js"));
			// gcc.addFile(IO.join(IO.cwd(), ".tmp/stream.js"));

			gcc.addFile(IO.join(IO.cwd(), "lib/interpreter/json2.js"));
			gcc.addFile(IO.join(IO.cwd(), ".tmp/parser.js"));
			gcc.addFile(IO.join(IO.cwd(), "lib/interpreter/interpreter.js"));
			gcc.addFile(IO.join(IO.cwd(), ".tmp/jediscript.js"));

			//Prevent these symbols from being renamed
			gcc.addFile(IO.join(IO.cwd(), ".tmp/exports.js"));

			//Compile and write output to compiled.js
			gcc.compile(writeBack);
		}
	}
}

function generatePackage(week, debug, native, without_jquery) {
	generateInterpreter(week, debug, native, without_jquery, writeOutput);

	//Callback function after our sources have been compiled by GCC.
	function writeOutput(code) {
		//Merge jQuery with the rest of our code.
		IO.write(IO.join(IO.cwd(), "out/lib/jediscript.js"),
			IO.read(IO.join(IO.cwd(), ".tmp/jquery.js")) + "\n\n" +
			code);

		//Zip the package up.
		var package = new zip();
		var basename = "JediScript Week " + week;
		package = package.folder(basename);

		function zipFolder(folder, package) {
			var files = fs.readdirSync(folder);
			for (var i = 0; i != files.length; ++i) {
				var path = IO.join(folder, files[i]);
				var stat = fs.statSync(path);
				if (stat.isDirectory()) {
					zipFolder(path, package.folder(files[i]));
				} else {
					package.file(files[i], IO.read(path, "base64"), {
						base64: true
					});
				}
			}
		}
		zipFolder(IO.join(IO.cwd(), "out"), package);


		IO.write(IO.join(IO.cwd(), basename + ".zip"),
			new Buffer(package.generate({
				base64:      true,
				compression: "DEFLATE"
			}), 'base64'));
	}
}

if (typeof process !== "undefined" || require.main === module)
	exports.main();
