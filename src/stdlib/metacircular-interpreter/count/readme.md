# Token Counting

This directory contains a script for counting the number of tokens in JediScript programs, mainly for scoring purposes in contests.

Only a single function, `count`, is exposed. It takes a JediScript program in the form of a string and returns a JavaScript object containing token counts, names, and source text of all top-level JediScript functions found therein.

It depends on tweaked versions of the JediScript runtime parsers, found in `lib/interpreter`. To change the parser used, modify `count-tokens.js`. The default parser is week 13's.
