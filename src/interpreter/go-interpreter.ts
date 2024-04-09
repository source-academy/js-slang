import {type Value} from "../types";

class BreakValue {};
class ContinueValue{};

class ReturnStatement {
  constructor(public value : Value) {}
}

