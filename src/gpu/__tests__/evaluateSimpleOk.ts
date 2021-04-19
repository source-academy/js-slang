import { mockContext } from '../../mocks/context'
import { stripIndent } from '../../utils/formatters'
import { runInContext } from '../../index'

test('simple 1 for-loop evaluation correct', done => {
  const code = stripIndent`
    let arr = [];
    for (let i = 0; i < 10; i = i + 1) {
      arr[i] = i * 2;
    }
    arr;
    `
  const expected = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    console.log(res)
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('simple 2 for-loop evaluation correct', done => {
  const code = stripIndent`
    let arr = [];
    for (let i = 0; i < 5; i = i + 1) {
          arr[i] = [];
    }
    for (let i = 0; i < 5; i = i + 1) {
      for (let j = 0; j < 4; j = j + 1) {
        const x = i * j;
        arr[i][j] = x;
      }
    }
    arr;
    `
  const expected = [
    [0, 0, 0, 0],
    [0, 1, 2, 3],
    [0, 2, 4, 6],
    [0, 3, 6, 9],
    [0, 4, 8, 12]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('simple 3 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        const x = i * j * k;
        arr[i][j][k] = x;
      }
    }
  }
  arr;
  `
  const expected = [
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 1, 2],
      [0, 2, 4],
      [0, 3, 6]
    ],
    [
      [0, 0, 0],
      [0, 2, 4],
      [0, 4, 8],
      [0, 6, 12]
    ],
    [
      [0, 0, 0],
      [0, 3, 6],
      [0, 6, 12],
      [0, 9, 18]
    ],
    [
      [0, 0, 0],
      [0, 4, 8],
      [0, 8, 16],
      [0, 12, 24]
    ]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('simple 4 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          const x = i * j * k * l;
          arr[i][j][k][l] = x;
        }
      }
    }
  }
  arr;
  `
  const expected = [
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2]
      ],
      [
        [0, 0],
        [0, 2],
        [0, 4]
      ],
      [
        [0, 0],
        [0, 3],
        [0, 6]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 2],
        [0, 4]
      ],
      [
        [0, 0],
        [0, 4],
        [0, 8]
      ],
      [
        [0, 0],
        [0, 6],
        [0, 12]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 3],
        [0, 6]
      ],
      [
        [0, 0],
        [0, 6],
        [0, 12]
      ],
      [
        [0, 0],
        [0, 9],
        [0, 18]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 4],
        [0, 8]
      ],
      [
        [0, 0],
        [0, 8],
        [0, 16]
      ],
      [
        [0, 0],
        [0, 12],
        [0, 24]
      ]
    ]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('simple 5 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
        for (let l = 0; l < 2; l = l + 1) {
          arr[i][j][k][l] = [];
        }
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          for (let m = 0; m < 1; m = m + 1) {
            const x = i + j + k + l + m;
            arr[i][j][k][l][m] = x;
          }
        }
      }
    }
  }
  arr;
  `
  const expected = [
    [
      [
        [[0], [1]],
        [[1], [2]],
        [[2], [3]]
      ],
      [
        [[1], [2]],
        [[2], [3]],
        [[3], [4]]
      ],
      [
        [[2], [3]],
        [[3], [4]],
        [[4], [5]]
      ],
      [
        [[3], [4]],
        [[4], [5]],
        [[5], [6]]
      ]
    ],
    [
      [
        [[1], [2]],
        [[2], [3]],
        [[3], [4]]
      ],
      [
        [[2], [3]],
        [[3], [4]],
        [[4], [5]]
      ],
      [
        [[3], [4]],
        [[4], [5]],
        [[5], [6]]
      ],
      [
        [[4], [5]],
        [[5], [6]],
        [[6], [7]]
      ]
    ],
    [
      [
        [[2], [3]],
        [[3], [4]],
        [[4], [5]]
      ],
      [
        [[3], [4]],
        [[4], [5]],
        [[5], [6]]
      ],
      [
        [[4], [5]],
        [[5], [6]],
        [[6], [7]]
      ],
      [
        [[5], [6]],
        [[6], [7]],
        [[7], [8]]
      ]
    ],
    [
      [
        [[3], [4]],
        [[4], [5]],
        [[5], [6]]
      ],
      [
        [[4], [5]],
        [[5], [6]],
        [[6], [7]]
      ],
      [
        [[5], [6]],
        [[6], [7]],
        [[7], [8]]
      ],
      [
        [[6], [7]],
        [[7], [8]],
        [[8], [9]]
      ]
    ],
    [
      [
        [[4], [5]],
        [[5], [6]],
        [[6], [7]]
      ],
      [
        [[5], [6]],
        [[6], [7]],
        [[7], [8]]
      ],
      [
        [[6], [7]],
        [[7], [8]],
        [[8], [9]]
      ],
      [
        [[7], [8]],
        [[8], [9]],
        [[9], [10]]
      ]
    ]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 2 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      const x = i * j;
      arr[i] = x;
    }
  }
  arr;
    `
  const expected = [0, 3, 6, 9, 12]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 3 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        const x = i * j * k;
        arr[i][j] = x;
      }
    }
  }
  arr;
    `
  const expected = [
    [0, 0, 0, 0],
    [0, 2, 4, 6],
    [0, 4, 8, 12],
    [0, 6, 12, 18],
    [0, 8, 16, 24]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 3 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        const x = i * j * k;
        arr[i] = x;
      }
    }
  }
  arr;
    `
  const expected = [0, 6, 12, 18, 24]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 4 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          const x = i * j * k * l;
          arr[i][j][k] = x;
        }
      }
    }
  }
  arr;
    `
  const expected = [
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 1, 2],
      [0, 2, 4],
      [0, 3, 6]
    ],
    [
      [0, 0, 0],
      [0, 2, 4],
      [0, 4, 8],
      [0, 6, 12]
    ],
    [
      [0, 0, 0],
      [0, 3, 6],
      [0, 6, 12],
      [0, 9, 18]
    ],
    [
      [0, 0, 0],
      [0, 4, 8],
      [0, 8, 16],
      [0, 12, 24]
    ]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 4 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          const x = i * j * k * l;
          arr[i][j] = x;
        }
      }
    }
  }
  arr;
    `
  const expected = [
    [0, 0, 0, 0],
    [0, 2, 4, 6],
    [0, 4, 8, 12],
    [0, 6, 12, 18],
    [0, 8, 16, 24]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 4 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          const x = i * j * k * l;
          arr[i] = x;
        }
      }
    }
  }
  arr;
    `
  const expected = [0, 6, 12, 18, 24]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 5 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
        for (let l = 0; l < 2; l = l + 1) {
          arr[i][j][k][l] = [];
        }
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          for (let m = 0; m < 1; m = m + 1) {
            const x = i * j * k * l * m;
            arr[i][j][k][l] = x;
          }
        }
      }
    }
  }
  arr;
    `
  const expected = [
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    ],
    [
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    ]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 5 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
        for (let l = 0; l < 2; l = l + 1) {
          arr[i][j][k][l] = [];
        }
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          for (let m = 0; m < 1; m = m + 1) {
            const x = i * j * k * l * m;
            arr[i][j][k] = x;

          }
        }
      }
    }
  }
  arr;
    `
  const expected = [
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  ]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})

test('prefix 5 for-loop evaluation correct', done => {
  const code = stripIndent`
  let arr = [];
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = [];
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = [];
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = [];
        for (let l = 0; l < 2; l = l + 1) {
          arr[i][j][k][l] = [];
        }
      }
    }
  }
  for (let i = 0; i < 5; i = i + 1) {
    for (let j = 0; j < 4; j = j + 1) {
      for (let k = 0; k < 3; k = k + 1) {
        for (let l = 0; l < 2; l = l + 1) {
          for (let m = 0; m < 1; m = m + 1) {
            const x = i * j * k * l * m;
            arr[i]= x;

          }
        }
      }
    }
  }
  arr;
    `
  const expected = [0, 0, 0, 0, 0]

  const context = mockContext(4, 'gpu')
  const res = runInContext(code, context)
  res.then(res => {
    try {
      expect(res['value']).toEqual(expected)
      done()
    } catch (error) {
      done(error)
    }
  })
})
