/* This file uses programs from SICP JS 4.3 as tests for the non deterministic interpreter */
import { testNonDeterministicCode } from './non-det-interpreter'

test('An element of', async () => {
  await testNonDeterministicCode(`an_element_of(list(1, 2, list(3, 4)));`, [1, 2, [3, [4, null]]])
})

test('An integer between', async () => {
  await testNonDeterministicCode('an_integer_between(5, 10);', [5, 6, 7, 8, 9, 10])
})

test('Pythagorean triple', async () => {
  await testNonDeterministicCode(
    `function a_pythagorean_triple_between(low, high) {
         const i = an_integer_between(low, high);
         const j = an_integer_between(i, high);
         const k = an_integer_between(j, high);
         require(i * i + j * j === k * k);
         return list(i, j, k);
       }
       a_pythagorean_triple_between(3, 5);`,
    [[3, [4, [5, null]]]]
  )
})

test('Multiple dwelling problem', async () => {
  await testNonDeterministicCode(
    `
    function distinct(items) {
      return is_null(items)
          ? true
          : is_null(tail(items))
          ? true
          : is_null(member(head(items), tail(items)))
              ? distinct(tail(items))
              : false;
    }
    function multiple_dwelling() {
            const baker = amb(1, 2, 3, 4, 5);
            const cooper = amb(1, 2, 3, 4, 5);
            const fletcher = amb(1, 2, 3, 4, 5);
            const miller = amb(1, 2, 3, 4, 5);
            const smith = amb(1, 2, 3, 4, 5);
            require(distinct(list(baker, cooper, fletcher, miller, smith)));
            require(!(baker === 5));
            require(!(cooper === 1));
            require(!(fletcher === 5));
            require(!(fletcher === 1));
            require((miller > cooper));
            require(!(math_abs(smith - fletcher) === 1));
            require(!(math_abs(fletcher - cooper) === 1));
            return list(list("baker", baker),
                        list("cooper", cooper),
                        list("fletcher", fletcher),
                        list("miller", miller),
                        list("smith", smith));
        }
        multiple_dwelling();`,
    [
      [
        ['baker', [3, null]],
        [
          ['cooper', [2, null]],
          [
            ['fletcher', [4, null]],
            [
              ['miller', [5, null]],
              [['smith', [1, null]], null]
            ]
          ]
        ]
      ]
    ]
  )
})

test('Language parsing', async () => {
  await testNonDeterministicCode(
    `
    let unparsed = null;

    const nouns = list("noun", "student", "professor", "cat", "class");
    const verbs = list("verb", "studies", "lectures", "eats", "sleeps");
    const articles = list("article", "the", "a");
    const prepositions = list("prep", "for", "to",  "in", "by", "with");

    function parse_word(word_list) {
      require(! is_null(unparsed));
      require(member(head(unparsed), tail(word_list)) !== null);
      const found_word = head(unparsed);
      unparsed = tail(unparsed);
      return list(head(word_list), found_word);
    }

    function parse_prepositional_phrase() {
      return list("prep-phrase",
                  parse_word(prepositions),
                  parse_noun_phrase());
    }

    function parse_verb_phrase() {
      function maybe_extend(verb_phrase) {
          return amb(verb_phrase,
                     maybe_extend(list("verb-phrase",
                                       verb_phrase,
                                       parse_prepositional_phrase())));
      }
      return maybe_extend(parse_word(verbs));
    }

    function parse_simple_noun_phrase() {
      return list("simple-noun-phrase",
                  parse_word(articles),
                  parse_word(nouns));
    }

    function parse_noun_phrase() {
      function maybe_extend(noun_phrase) {
          return amb(noun_phrase,
                     maybe_extend(list("noun-phrase",
                                       noun_phrase,
                                       parse_prepositional_phrase())));
      }
      return maybe_extend(parse_simple_noun_phrase());
    }

    function parse_sentence() {
      return list("sentence",
                  parse_noun_phrase(),
                  parse_verb_phrase());
    }

    function parse_input(input) {
      unparsed = input;
      const sent = parse_sentence();
      require(is_null(unparsed));
      return sent;
    }

    parse_input(list("the", "student", "with", "the", "cat", "sleeps", "in", "the", "class"));
  `,
    [
      [
        'sentence',
        [
          [
            'noun-phrase',
            [
              [
                'simple-noun-phrase',
                [
                  ['article', ['the', null]],
                  [['noun', ['student', null]], null]
                ]
              ],
              [
                [
                  'prep-phrase',
                  [
                    ['prep', ['with', null]],
                    [
                      [
                        'simple-noun-phrase',
                        [
                          ['article', ['the', null]],
                          [['noun', ['cat', null]], null]
                        ]
                      ],
                      null
                    ]
                  ]
                ],
                null
              ]
            ]
          ],
          [
            [
              'verb-phrase',
              [
                ['verb', ['sleeps', null]],
                [
                  [
                    'prep-phrase',
                    [
                      ['prep', ['in', null]],
                      [
                        [
                          'simple-noun-phrase',
                          [
                            ['article', ['the', null]],
                            [['noun', ['class', null]], null]
                          ]
                        ],
                        null
                      ]
                    ]
                  ],
                  null
                ]
              ]
            ],
            null
          ]
        ]
      ]
    ]
  )
})
