import { mockContext } from "../mocks/context";
import { parseError, runInContext } from "../index";
import { Finished } from "../types";

// This is bad practice. Don't do this!
test("standalone block statements", () => {
  const code = `
    function test(){
      const x = true;
      {
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
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("finished");
    expect(obj).toMatchSnapshot();



    expect((obj as Finished).value).toBe(true);

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

//see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
//and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
test("for loop `let` variables are copied into the block scope", () => {
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
    expect((obj as Finished).value).toBe(1);
    expect(obj).toMatchSnapshot();
  });
});

test("Cannot overwrite loop variables within a block", () => {
  const code = `
  function test(){
      let z = [];
      for (let x = 0; x < 2; x = x + 1) {
        x = 1;
      }
      return false;
  }
  test();
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors);
    expect(errors).toMatchSnapshot();
  });
});

test("Cannot leave blank expressions in for loops", () => {
  const code = [
    `
    for(; i < 3; i++) {
      break;
    }
  `,
    `
    for(let i = 0; ; i++) {
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
