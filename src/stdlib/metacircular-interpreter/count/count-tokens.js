
var jison = require("./lib/interpreter/parser-week-13");

function parse(text) {
	return new jison.Parser().parse(text);
}

function findSource(text, start_line, start_col, end_line, end_col) {
	var lines = text.replace(/\r/g, '').split('\n');

	--start_line, --end_line; // 0-based indexing for lines
	// cols are already 0-based

	var range = [];
	for (var i=start_line; i<=end_line; i++) {
		range.push(lines[i]);
	}

	if (range.length === 1) {
		range[0] = range[0].slice(start_col, end_col+1);
		return range[0];
	} else {
		range[0] = range[0].slice(start_col);
		range[range.length-1] = range[range.length-1].slice(0, end_col+1);
		return range.join('\n');
	}
}

function listToArray(xs) {
	var result = [];
	while (xs.length !== 0) {
		result.push(xs[0]);
		xs = xs[1];
	}
	return result;
}

function findTopLevelFunctionDeclarations(text) {
	var ast = listToArray(parse(text));
	var declarations = ast.filter(function (node) {
		return node.tag === 'var_definition'
			&& node.value
			&& node.value.tag === 'function_definition';
	}).map(function (node) {
		var loc = node.value.location;
		return {
			name: node.variable,
			source: findSource(text, loc.start_line, loc.start_col, loc.end_line, loc.end_col)
		};
	});
	return declarations;
}

// Invert symbol object so we can easily lookup symbol names

var symbols = new jison.Parser().symbols_;
var symbolName = {};
Object.keys(symbols).forEach(function (key) {
	symbolName[symbols[key]] = key;
});

function lex(input) {
	var lexer = new jison.Parser().lexer;
	lexer.setInput(input);
	var token;
	var tokens = [];
	while (symbolName[token = lexer.lex()] !== 'EOF') {
		tokens.push(symbolName[token]);
	}
	return tokens;
}

module.exports = {
	count: function(program) {
		var declarations = findTopLevelFunctionDeclarations(program);
		declarations.forEach(function (item) {
			item.count = lex(item.source).length;
		});
		return declarations;
	}
};