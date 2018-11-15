/**
 * This file contains tests for regressions that TCO may have caused.
 * Please reference Issue #124
 */

import { mockContext } from "../mocks/context";
import { runInContext } from "../index";
import { Finished } from "../types";

// This is bad practice. Don't do this!
test("Bare early returns work", () => {
  const code = `
    function f() {
      return 1;
      return 0;
    }
    f();
  `
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Recursive call early returns work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      return id(1) + id(2);
      return 0;
    }
    f();
  `
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(3);
  });
});

// This is bad practice. Don't do this!
test("Tail call early returns work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      return id(1);
      return 0;
    }
    f();
  `
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Bare early returns in if statements work", () => {
  const code = `
    function f() {
      if (true) {
        return 1;
      } else {}
      return 0;
    }
    f();
  `
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Recursive call early returns in if statements work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      if (true) {
        return id(1) + id(2);
      } else {}
      return 0;
    }
    f();
  `
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(3);
  });
});

// This is bad practice. Don't do this!
test("Tail call early returns in if statements work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      if (true) {
        return id(1);
      } else {}
      return 0;
    }
    f();
  `
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Bare early returns in while loops work", () => {
  const code = `
    function f() {
      while (true) {
        return 1;
      }
      return 0;
    }
    f();
  `
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Recursive call early returns in while loops work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      while (true) {
        return id(1) + id(2);
      }
      return 0;
    }
    f();
  `
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(3);
  });
});

// This is bad practice. Don't do this!
test("Tail call early returns in while loops work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      while (true) {
        return id(1);
      }
      return 0;
    }
    f();
  `
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Bare early returns in for loops work", () => {
  const code = `
    function f() {
      for (let i = 0; i < 100; i = i + 1) {
        return i+1;
      }
      return 0;
    }
    f();
  `
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});

// This is bad practice. Don't do this!
test("Recursive call early returns in for loops work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      for (let i = 0; i < 100; i = i + 1) {
        return id(i+1) + id(i+2);
      }
      return 0;
    }
    f();
  `
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(3);
  });
});

// This is bad practice. Don't do this!
test("Tail call early returns in for loops work", () => {
  const code = `
    function id(x) {
      return x;
    }
    function f() {
      for (let i = 0; i < 100; i = i + 1) {
        return id(i+1);
      }
      return 0;
    }
    f();
  `
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(context.errors).toEqual([]);
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(1);
  });
});
