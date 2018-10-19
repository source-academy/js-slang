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

test("Cannot use js function expressions", () => {
  const code = `
  map(function(x) {
    return x + 1;
  }, list(1));
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors);
    expect(errors).toMatchSnapshot();
  });
});

test("DEFINITELY CANNOT use named function declarations as expressions", () => {
  const code = `
  map(function a(x) {
    return x + 1;
  }, list(1));
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors);
    expect(errors).toMatchSnapshot();
  });
});
