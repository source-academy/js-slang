import { mockContext } from "../mocks/context";
import { runInContext } from "../index";
import { Finished } from "../types";

// This is bad practice. Don't do this!
test("const uses block scoping instead of function scoping", () => {
  const code = `
    function test(){
      const x = true;
      if(true) {
          const x = false;
      } else {
          const x = false;
      }
      return x;
    }
    test();
  `;
  const context = mockContext();
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj).toMatchSnapshot();
    expect(obj.status).toBe("finished");
    expect((obj as Finished).value).toBe(true);
  });
});

// This is bad practice. Don't do this!
test("let uses block scoping instead of function scoping", () => {
  const code = `
    function test(){
      let x = true;
      if(true) {
          let x = false;
      } else {
          let x = false;
      }
      return x;
    }
    test();
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("finished");
    expect(obj).toMatchSnapshot();
    expect((obj as Finished).value).toBe(true);
  });
});

// This is bad practice. Don't do this!
test("for loops use block scoping instead of function scoping", () => {
  const code = `
    function test(){
      let x = true;
      for (let x = 1; x > 0; x = x - 1) {
      }
      return x;
    }
    test();
  `;
  const context = mockContext(4);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("finished");
    expect(obj).toMatchSnapshot();
    expect((obj as Finished).value).toBe(true);
  });
});

// This is bad practice. Don't do this!
test("interior of for loops don't affect loop variables", () => {
  const code = `
    function test(){
      let result = 0;
      for (let x = 4; ; x = x - 1) {
        result = result + 1;
        break;
      }
      return result;
    }
    test();
  `;
  const context = mockContext(4);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("finished");
    expect(obj).toMatchSnapshot();
    expect((obj as Finished).value).toBe(4);
  });
});

// This is bad practice. Don't do this!
test("while loops use block scoping instead of function scoping", () => {
  const code = `
    function test(){
      let x = true;
      while (true) {
        let x = false;
        break;
      }
      return x;
    }
    test();
  `;
  const context = mockContext(4);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("finished");
    expect(obj).toMatchSnapshot();
    expect((obj as Finished).value).toBe(true);
  });
});

test("for loop `let` variables are copied into the block scope", () => {
  // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
  // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
  const code = `
  function test(){
        let z = [];
        for (let x = 0; x < 2; x = x + 1) {
          z[x] = () => x;
        }
        return z[1]();
  }
  test();
  `;
  const context = mockContext(4);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("finished");
    expect(obj).toMatchSnapshot();
    expect((obj as Finished).value).toBe(1);
  });
})