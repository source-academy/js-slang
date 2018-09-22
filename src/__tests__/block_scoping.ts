import { stripIndent } from "common-tags";
import { mockContext } from "../mocks/context";
import { parseError, runInContext } from "../index";
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
      for (let x = 4; x > 0; x = x - 1) {
        result = result + 1;
        let x = 0;
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
