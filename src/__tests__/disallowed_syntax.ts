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

test("Cannot have incomplete statements", () => {
  const code = `
  5
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors);
    expect(errors).toMatchSnapshot();
  });
});

test("Cannot have if without else", () => {
  const code = `
  if (true) { 5; }
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors);
    expect(errors).toMatchSnapshot();
  });
});

test("Cannot use assignment expressions", () => {
  const code = `
  let x = 3;
  let y = x = 5;
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

test("Cannot use update statements", () => {
  const code = `
  let x = 3;
  x += 5;
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

