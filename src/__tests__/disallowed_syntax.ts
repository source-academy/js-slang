import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'

test("Cannot leave blank expressions in for loops", () => {
  const code = [
    `
    for(; i < 3; i = i + 1) {
      break;
    }
  `,
    `
    for(let i = 0; ; i = i + 1) {
      break;
    }
  `,
    `
    for(let i = 0; i < 3;) {
      break;
    }
  `,
    `
    for(;;) {
      break;
    }
  `
  ];
  const scheduler = "preemptive";
  const promises = code.map(c => {
    const context = mockContext(3);
    return runInContext(c, context, { scheduler }).then(obj => ({
      context,
      obj
    }));
  });
  return Promise.all(promises).then(results => {
    results.map(res => {
      const { context, obj } = res;
      expect(obj.status).toBe("error");
      const errors = parseError(context.errors);
      expect(errors).toMatchSnapshot();
    });
  });
});

test("Cannot use update expressions", () => {
  const code = `
  let x = 3;
  x++;
  x;
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors);
    expect(errors).toMatchSnapshot();
  });
});


test("Compound assignment not allowed", () => {
  const code = `
    let x = 1;
	x += 1;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe("error")
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe("Line 3: Compound assignment '+=' not allowed")
  })
})
