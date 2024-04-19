import { stringToAst } from "../../ast/ast"
import { compile, debugCompile } from "../../compiler/compiler"
import { GoVirtualMachine } from "../go-vm"

const string_test_str = 
`
{
    "Comments": [],
    "Decls": [
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 26,
            "Line": 3,
            "Column": 13
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 14,
            "Line": 3,
            "Column": 1
          }
        },
        "Lparen": 0,
        "Rparen": 0,
        "Specs": [
          {
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 26,
                "Line": 3,
                "Column": 13
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 21,
                "Line": 3,
                "Column": 8
              }
            },
            "Path": {
              "Kind": "STRING",
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 26,
                  "Line": 3,
                  "Column": 13
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 21,
                  "Line": 3,
                  "Column": 8
                }
              },
              "Value": "fmt",
              "_type": "BasicLit"
            },
            "_type": "ImportSpec"
          }
        ],
        "Tok": "import",
        "_type": "GenDecl"
      },
      {
        "Body": {
          "Lbrace": 41,
          "List": [
            {
              "Lhs": [
                {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 45,
                      "Line": 6,
                      "Column": 4
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 44,
                      "Line": 6,
                      "Column": 3
                    }
                  },
                  "Name": "x",
                  "_type": "Ident"
                },
                {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 48,
                      "Line": 6,
                      "Column": 7
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 47,
                      "Line": 6,
                      "Column": 6
                    }
                  },
                  "Name": "y",
                  "_type": "Ident"
                }
              ],
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 64,
                  "Line": 6,
                  "Column": 23
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 44,
                  "Line": 6,
                  "Column": 3
                }
              },
              "Rhs": [
                {
                  "Kind": "STRING",
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 57,
                      "Line": 6,
                      "Column": 16
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 52,
                      "Line": 6,
                      "Column": 11
                    }
                  },
                  "Value": "abc",
                  "_type": "BasicLit"
                },
                {
                  "Kind": "STRING",
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 64,
                      "Line": 6,
                      "Column": 23
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 59,
                      "Line": 6,
                      "Column": 18
                    }
                  },
                  "Value": "def",
                  "_type": "BasicLit"
                }
              ],
              "Tok": ":=",
              "_type": "AssignStmt"
            },
            {
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 79,
                  "Line": 7,
                  "Column": 15
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 67,
                  "Line": 7,
                  "Column": 3
                }
              },
              "X": {
                "Args": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 78,
                        "Line": 7,
                        "Column": 14
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 73,
                        "Line": 7,
                        "Column": 9
                      }
                    },
                    "Op": "+",
                    "X": {
                      "Loc": {
                        "End": {
                          "Filename": "main.go",
                          "Offset": 74,
                          "Line": 7,
                          "Column": 10
                        },
                        "Start": {
                          "Filename": "main.go",
                          "Offset": 73,
                          "Line": 7,
                          "Column": 9
                        }
                      },
                      "Name": "x",
                      "_type": "Ident"
                    },
                    "Y": {
                      "Loc": {
                        "End": {
                          "Filename": "main.go",
                          "Offset": 78,
                          "Line": 7,
                          "Column": 14
                        },
                        "Start": {
                          "Filename": "main.go",
                          "Offset": 77,
                          "Line": 7,
                          "Column": 13
                        }
                      },
                      "Name": "y",
                      "_type": "Ident"
                    },
                    "_type": "BinaryExpr"
                  }
                ],
                "Ellipsis": 0,
                "Fun": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 72,
                      "Line": 7,
                      "Column": 8
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 67,
                      "Line": 7,
                      "Column": 3
                    }
                  },
                  "Name": "print",
                  "_type": "Ident"
                },
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 79,
                    "Line": 7,
                    "Column": 15
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 67,
                    "Line": 7,
                    "Column": 3
                  }
                },
                "Lparen": 73,
                "Rparen": 79,
                "_type": "CallExpr"
              },
              "_type": "ExprStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 81,
              "Line": 8,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 40,
              "Line": 5,
              "Column": 13
            }
          },
          "Rbrace": 81,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 81,
            "Line": 8,
            "Column": 2
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 28,
            "Line": 5,
            "Column": 1
          }
        },
        "Name": {
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 37,
              "Line": 5,
              "Column": 10
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 33,
              "Line": 5,
              "Column": 6
            }
          },
          "Name": "main",
          "_type": "Ident"
        },
        "Type": {
          "Func": 29,
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 39,
              "Line": 5,
              "Column": 12
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 28,
              "Line": 5,
              "Column": 1
            }
          },
          "Params": {
            "Closing": 39,
            "List": [],
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 39,
                "Line": 5,
                "Column": 12
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 37,
                "Line": 5,
                "Column": 10
              }
            },
            "Opening": 38,
            "_type": "FieldList"
          },
          "_type": "FuncType"
        },
        "_type": "FuncDecl"
      }
    ],
    "Imports": [
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 26,
            "Line": 3,
            "Column": 13
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 21,
            "Line": 3,
            "Column": 8
          }
        },
        "Path": {
          "Kind": "STRING",
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 26,
              "Line": 3,
              "Column": 13
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 21,
              "Line": 3,
              "Column": 8
            }
          },
          "Value": "fmt",
          "_type": "BasicLit"
        },
        "_type": "ImportSpec"
      }
    ],
    "Loc": {
      "End": {
        "Filename": "main.go",
        "Offset": 81,
        "Line": 8,
        "Column": 2
      },
      "Start": {
        "Filename": "main.go",
        "Offset": 0,
        "Line": 1,
        "Column": 1
      }
    },
    "Name": {
      "Loc": {
        "End": {
          "Filename": "main.go",
          "Offset": 12,
          "Line": 1,
          "Column": 13
        },
        "Start": {
          "Filename": "main.go",
          "Offset": 8,
          "Line": 1,
          "Column": 9
        }
      },
      "Name": "main",
      "_type": "Ident"
    },
    "Package": 1,
    "Unresolved": [
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 72,
            "Line": 7,
            "Column": 8
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 67,
            "Line": 7,
            "Column": 3
          }
        },
        "Name": "print",
        "_type": "Ident"
      }
    ],
    "_type": "File"
  }
`

const goroutine_inst = compile(stringToAst(string_test_str))
debugCompile(goroutine_inst)
const vm = new GoVirtualMachine(goroutine_inst, false)
vm.run()
