import { stringToAst } from "../../ast/ast"
import { compile, debugCompile } from "../compiler"

let json_prog_1 = `
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
              "Decl": {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 55,
                    "Line": 6,
                    "Column": 14
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 44,
                    "Line": 6,
                    "Column": 3
                  }
                },
                "Lparen": 0,
                "Rparen": 0,
                "Specs": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 55,
                        "Line": 6,
                        "Column": 14
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 50,
                        "Line": 6,
                        "Column": 9
                      }
                    },
                    "Names": [
                      {
                        "Loc": {
                          "End": {
                            "Filename": "main.go",
                            "Offset": 51,
                            "Line": 6,
                            "Column": 10
                          },
                          "Start": {
                            "Filename": "main.go",
                            "Offset": 50,
                            "Line": 6,
                            "Column": 9
                          }
                        },
                        "Name": "a",
                        "_type": "Ident"
                      }
                    ],
                    "Values": [
                      {
                        "Kind": "INT",
                        "Loc": {
                          "End": {
                            "Filename": "main.go",
                            "Offset": 55,
                            "Line": 6,
                            "Column": 14
                          },
                          "Start": {
                            "Filename": "main.go",
                            "Offset": 54,
                            "Line": 6,
                            "Column": 13
                          }
                        },
                        "Value": "1",
                        "_type": "BasicLit"
                      }
                    ],
                    "_type": "ValueSpec"
                  }
                ],
                "Tok": "const",
                "_type": "GenDecl"
              },
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 55,
                  "Line": 6,
                  "Column": 14
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 44,
                  "Line": 6,
                  "Column": 3
                }
              },
              "_type": "DeclStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 57,
              "Line": 7,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 40,
              "Line": 5,
              "Column": 13
            }
          },
          "Rbrace": 57,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 57,
            "Line": 7,
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
        "Offset": 57,
        "Line": 7,
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
    "Unresolved": [],
    "_type": "File"
  }`

 const prog_2_str = `
 {
    "Comments": [],
    "Decls": [
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 34,
            "Line": 5,
            "Column": 2
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 14,
            "Line": 3,
            "Column": 1
          }
        },
        "Lparen": 22,
        "Rparen": 34,
        "Specs": [
          {
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 32,
                "Line": 4,
                "Column": 10
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 27,
                "Line": 4,
                "Column": 5
              }
            },
            "Path": {
              "Kind": "STRING",
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 32,
                  "Line": 4,
                  "Column": 10
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 27,
                  "Line": 4,
                  "Column": 5
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
          "Lbrace": 50,
          "List": [
            {
              "Lhs": [
                {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 59,
                      "Line": 7,
                      "Column": 9
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 55,
                      "Line": 7,
                      "Column": 5
                    }
                  },
                  "Name": "test",
                  "_type": "Ident"
                }
              ],
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 68,
                  "Line": 7,
                  "Column": 18
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 55,
                  "Line": 7,
                  "Column": 5
                }
              },
              "Rhs": [
                {
                  "Args": [],
                  "Ellipsis": 0,
                  "Fun": {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 66,
                        "Line": 7,
                        "Column": 16
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 63,
                        "Line": 7,
                        "Column": 13
                      }
                    },
                    "Name": "foo",
                    "_type": "Ident"
                  },
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 68,
                      "Line": 7,
                      "Column": 18
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 63,
                      "Line": 7,
                      "Column": 13
                    }
                  },
                  "Lparen": 67,
                  "Rparen": 68,
                  "_type": "CallExpr"
                }
              ],
              "Tok": ":=",
              "_type": "AssignStmt"
            },
            {
              "Decl": {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 81,
                    "Line": 8,
                    "Column": 13
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 72,
                    "Line": 8,
                    "Column": 4
                  }
                },
                "Lparen": 0,
                "Rparen": 0,
                "Specs": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 81,
                        "Line": 8,
                        "Column": 13
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 76,
                        "Line": 8,
                        "Column": 8
                      }
                    },
                    "Names": [
                      {
                        "Loc": {
                          "End": {
                            "Filename": "main.go",
                            "Offset": 77,
                            "Line": 8,
                            "Column": 9
                          },
                          "Start": {
                            "Filename": "main.go",
                            "Offset": 76,
                            "Line": 8,
                            "Column": 8
                          }
                        },
                        "Name": "x",
                        "_type": "Ident"
                      }
                    ],
                    "Type": {
                      "Loc": {
                        "End": {
                          "Filename": "main.go",
                          "Offset": 81,
                          "Line": 8,
                          "Column": 13
                        },
                        "Start": {
                          "Filename": "main.go",
                          "Offset": 78,
                          "Line": 8,
                          "Column": 10
                        }
                      },
                      "Name": "int",
                      "_type": "Ident"
                    },
                    "Values": [],
                    "_type": "ValueSpec"
                  }
                ],
                "Tok": "var",
                "_type": "GenDecl"
              },
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 81,
                  "Line": 8,
                  "Column": 13
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 72,
                  "Line": 8,
                  "Column": 4
                }
              },
              "_type": "DeclStmt"
            },
            {
              "Lhs": [
                {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 86,
                      "Line": 9,
                      "Column": 5
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 85,
                      "Line": 9,
                      "Column": 4
                    }
                  },
                  "Name": "x",
                  "_type": "Ident"
                }
              ],
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 90,
                  "Line": 9,
                  "Column": 9
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 85,
                  "Line": 9,
                  "Column": 4
                }
              },
              "Rhs": [
                {
                  "Kind": "INT",
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 90,
                      "Line": 9,
                      "Column": 9
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 89,
                      "Line": 9,
                      "Column": 8
                    }
                  },
                  "Value": "5",
                  "_type": "BasicLit"
                }
              ],
              "Tok": "=",
              "_type": "AssignStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 92,
              "Line": 10,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 49,
              "Line": 6,
              "Column": 15
            }
          },
          "Rbrace": 92,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 92,
            "Line": 10,
            "Column": 2
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 35,
            "Line": 6,
            "Column": 1
          }
        },
        "Name": {
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 46,
              "Line": 6,
              "Column": 12
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 40,
              "Line": 6,
              "Column": 6
            }
          },
          "Name": "GetFoo",
          "_type": "Ident"
        },
        "Type": {
          "Func": 36,
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 48,
              "Line": 6,
              "Column": 14
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 35,
              "Line": 6,
              "Column": 1
            }
          },
          "Params": {
            "Closing": 48,
            "List": [],
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 48,
                "Line": 6,
                "Column": 14
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 46,
                "Line": 6,
                "Column": 12
              }
            },
            "Opening": 47,
            "_type": "FieldList"
          },
          "_type": "FuncType"
        },
        "_type": "FuncDecl"
      },
      {
        "Body": {
          "Lbrace": 109,
          "List": [
            {
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 122,
                  "Line": 12,
                  "Column": 13
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 114,
                  "Line": 12,
                  "Column": 5
                }
              },
              "Results": [
                {
                  "Kind": "INT",
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 122,
                      "Line": 12,
                      "Column": 13
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 121,
                      "Line": 12,
                      "Column": 12
                    }
                  },
                  "Value": "0",
                  "_type": "BasicLit"
                }
              ],
              "Return": 115,
              "_type": "ReturnStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 124,
              "Line": 13,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 108,
              "Line": 11,
              "Column": 16
            }
          },
          "Rbrace": 124,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 124,
            "Line": 13,
            "Column": 2
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 93,
            "Line": 11,
            "Column": 1
          }
        },
        "Name": {
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 101,
              "Line": 11,
              "Column": 9
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 98,
              "Line": 11,
              "Column": 6
            }
          },
          "Name": "foo",
          "_type": "Ident"
        },
        "Type": {
          "Func": 94,
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 107,
              "Line": 11,
              "Column": 15
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 93,
              "Line": 11,
              "Column": 1
            }
          },
          "Params": {
            "Closing": 103,
            "List": [],
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 103,
                "Line": 11,
                "Column": 11
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 101,
                "Line": 11,
                "Column": 9
              }
            },
            "Opening": 102,
            "_type": "FieldList"
          },
          "Results": {
            "Closing": 0,
            "List": [
              {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 107,
                    "Line": 11,
                    "Column": 15
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 104,
                    "Line": 11,
                    "Column": 12
                  }
                },
                "Names": [],
                "Type": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 107,
                      "Line": 11,
                      "Column": 15
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 104,
                      "Line": 11,
                      "Column": 12
                    }
                  },
                  "Name": "int",
                  "_type": "Ident"
                },
                "_type": "Field"
              }
            ],
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 107,
                "Line": 11,
                "Column": 15
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 104,
                "Line": 11,
                "Column": 12
              }
            },
            "Opening": 0,
            "_type": "FieldList"
          },
          "_type": "FuncType"
        },
        "_type": "FuncDecl"
      },
      {
        "Body": {
          "Lbrace": 139,
          "List": [
            {
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 150,
                  "Line": 16,
                  "Column": 11
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 142,
                  "Line": 16,
                  "Column": 3
                }
              },
              "X": {
                "Args": [],
                "Ellipsis": 0,
                "Fun": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 148,
                      "Line": 16,
                      "Column": 9
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 142,
                      "Line": 16,
                      "Column": 3
                    }
                  },
                  "Name": "GetFoo",
                  "_type": "Ident"
                },
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 150,
                    "Line": 16,
                    "Column": 11
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 142,
                    "Line": 16,
                    "Column": 3
                  }
                },
                "Lparen": 149,
                "Rparen": 150,
                "_type": "CallExpr"
              },
              "_type": "ExprStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 152,
              "Line": 17,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 138,
              "Line": 15,
              "Column": 13
            }
          },
          "Rbrace": 152,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 152,
            "Line": 17,
            "Column": 2
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 126,
            "Line": 15,
            "Column": 1
          }
        },
        "Name": {
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 135,
              "Line": 15,
              "Column": 10
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 131,
              "Line": 15,
              "Column": 6
            }
          },
          "Name": "main",
          "_type": "Ident"
        },
        "Type": {
          "Func": 127,
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 137,
              "Line": 15,
              "Column": 12
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 126,
              "Line": 15,
              "Column": 1
            }
          },
          "Params": {
            "Closing": 137,
            "List": [],
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 137,
                "Line": 15,
                "Column": 12
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 135,
                "Line": 15,
                "Column": 10
              }
            },
            "Opening": 136,
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
            "Offset": 32,
            "Line": 4,
            "Column": 10
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 27,
            "Line": 4,
            "Column": 5
          }
        },
        "Path": {
          "Kind": "STRING",
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 32,
              "Line": 4,
              "Column": 10
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 27,
              "Line": 4,
              "Column": 5
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
        "Offset": 152,
        "Line": 17,
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
            "Offset": 81,
            "Line": 8,
            "Column": 13
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 78,
            "Line": 8,
            "Column": 10
          }
        },
        "Name": "int",
        "_type": "Ident"
      },
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 107,
            "Line": 11,
            "Column": 15
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 104,
            "Line": 11,
            "Column": 12
          }
        },
        "Name": "int",
        "_type": "Ident"
      }
    ],
    "_type": "File"
  }`

  let prog_2_inst = compile(stringToAst(prog_2_str))
  debugCompile(prog_2_inst)