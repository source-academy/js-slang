import { stripIndent } from 'common-tags'
import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { Finished } from '../types'
import { defineBuiltin } from '../createContext'

test('Empty code returns undefined', () => {
  const code = ''
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(undefined)
  })
})

test('Single string self-evaluates to itself', () => {
  const code = "'42';"
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('42')
  })
})

test('Allow display to return value it is displaying', () => {
  const code = '25*(display(1+1));'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(50)
  })
})

test('Single number self-evaluates to itself', () => {
  const code = '42;'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(42)
  })
})

test('Single boolean self-evaluates to itself', () => {
  const code = 'true;'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Arrow function definition returns itself', () => {
  const code = '() => 42;'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('Builtins hide their implementation', () => {
  const code = 'stringify(pair);'
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Builtins hide their implementation', () => {
  const code = '""+pair;'
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Objects toString matches up with JS', () => {
  const code = '"" + ({a: 1});'
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toEqual(eval(code))
  })
})

test('Arrays toString matches up with JS', () => {
  const code = '"" + [1, 2];'
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toEqual(eval(code))
  })
})

test('functions toString (mostly) matches up with JS', () => {
  const code = `
    function f(x) {
      return 5;
    }
    "" + (a=>b) + f;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value.replace(/ /g, '')).toEqual(eval(code).replace(/ /g, ''))
  })
})

test('primitives toString matches up with JS', () => {
  const code = '"" + true + false + 1 + 1.5 + null + undefined + NaN;'
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toEqual(eval(code))
  })
})

test('Factorial arrow function', () => {
  const code = stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(120)
  })
})

test('parseError for missing semicolon', () => {
  const code = '42'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Simple arrow function infinite recursion represents CallExpression well', () => {
  const code = '(x => x(x)(x))(x => x(x)(x));'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
}, 30000)

test('Simple function infinite recursion represents CallExpression well', () => {
  const code = 'function f(x) {return x(x)(x);} f(f);'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
}, 30000)

test('Cannot overwrite consts even when assignment is allowed', () => {
  const code = `
  function test(){
    const constant = 3;
    constant = 4;
    return constant;
  }
  test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Can overwrite lets when assignment is allowed', () => {
  const code = `
  function test(){
    let variable = false;
    variable = true;
    return variable;
  }
  test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Arrow function infinite recursion with list args represents CallExpression well', () => {
  const code = `
    const f = xs => append(f(xs), list());
    f(list(1, 2));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
}, 30000)

test('Function infinite recursion with list args represents CallExpression well', () => {
  const code = `
    function f(xs) { return append(f(xs), list()); }
    f(list(1, 2));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
}, 30000)

test('Arrow function infinite recursion with different args represents CallExpression well', () => {
  const code = `
    const f = i => f(i+1) - 1;
    f(0);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toEqual(
      expect.stringMatching(/^Line 2: Infinite recursion\n\ *(f\(\d*\)[^f]{2,4}){3}/)
    )
  })
}, 30000)

test('Function infinite recursion with different args represents CallExpression well', () => {
  const code = `
    function f(i) { return f(i+1) - 1; }
    f(0);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toEqual(
      expect.stringMatching(/^Line 2: Infinite recursion\n\ *(f\(\d*\)[^f]{2,4}){3}/)
    )
  })
}, 30000)

test('Functions passed into non-source functions remain equal', () => {
  const code = `
  function t(x, y, z) {
    return x + y + z;
  }
  identity(t) === t && t(1, 2, 3) === 6;
  `
  const context = mockContext(4)
  defineBuiltin(context, 'identity(x)', (x: any) => x)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Simple object assignment and retrieval', () => {
  const code = `
    const o = {};
    o.a = 1;
    o.a;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(1)
  })
})

test('Deep object assignment and retrieval', () => {
  const code = `
    const o = {};
    o.a = {};
    o.a.b = {};
    o.a.b.c = "string";
    o.a.b.c;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('string')
  })
})

test('Test apply_in_underlying_javascript', () => {
  const code = `
  apply_in_underlying_javascript((a, b, c) => a * b * c, list(2, 5, 6));
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(60)
  })
})

test('Test equal for primitives', () => {
  const code = `
  equal(1, 1) && equal("str", "str") && equal(null, null) && !equal(1, 2) && !equal("str", "");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Test equal for lists', () => {
  const code = `
  equal(list(1, 2), pair(1, pair(2, null))) && equal(list(1, 2, 3, 4), list(1, 2, 3, 4));
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Test equal for different lists', () => {
  const code = `
  !equal(list(1, 2), pair(1, 2)) && !equal(list(1, 2, 3), list(1, list(2, 3)));
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('true if with empty if works', () => {
  const code = `
    if (true) {
    } else {
    }
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(undefined)
  })
})

test('true if with nonempty if works', () => {
  const code = `
    if (true) {
      1;
    } else {
    }
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(1)
  })
})

test('false if with empty else works', () => {
  const code = `
    if (false) {
    } else {
    }
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(undefined)
  })
})

test('false if with nonempty if works', () => {
  const code = `
    if (false) {
    } else {
      2;
    }
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(2)
  })
})

test('test true conditional expression', () => {
  const code = `
    true ? true : false;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

test('test false conditional expression', () => {
  const code = `
    false ? true : false;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(false)
  })
})

test('test false && true', () => {
  const code = `
    false && true;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(false)
  })
})

test('test false && false', () => {
  const code = `
    false && false;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(false)
  })
})

test('test true && false', () => {
  const code = `
    true && false;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(false)
  })
})

test('test true && true', () => {
  const code = `
    true && true;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

test('test && shortcircuiting', () => {
  const code = `
    false && 1();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(false)
  })
})

test('test false || true', () => {
  const code = `
    false || true;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

test('test false || false', () => {
  const code = `
    false || false;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(false)
  })
})

test('test true || false', () => {
  const code = `
    true || false;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

test('test true || true', () => {
  const code = `
    true || true;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

test('test || shortcircuiting', () => {
  const code = `
    true || 1();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})
