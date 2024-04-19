import { compile, debugCompile } from "../../compiler/compiler"
import { stringToAst } from "../../ast/ast"
import { GoVirtualMachine } from "../go-vm"

const goroutine_str =
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
          "Lbrace": 51,
          "List": [
            {
              "Body": {
                "Lbrace": 78,
                "List": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 98,
                        "Line": 7,
                        "Column": 20
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 83,
                        "Line": 7,
                        "Column": 5
                      }
                    },
                    "X": {
                      "Args": [
                        {
                          "Kind": "STRING",
                          "Loc": {
                            "End": {
                              "Filename": "main.go",
                              "Offset": 97,
                              "Line": 7,
                              "Column": 19
                            },
                            "Start": {
                              "Filename": "main.go",
                              "Offset": 89,
                              "Line": 7,
                              "Column": 11
                            }
                          },
                          "Value": "Thread",
                          "_type": "BasicLit"
                        }
                      ],
                      "Ellipsis": 0,
                      "Fun": {
                        "Loc": {
                          "End": {
                            "Filename": "main.go",
                            "Offset": 88,
                            "Line": 7,
                            "Column": 10
                          },
                          "Start": {
                            "Filename": "main.go",
                            "Offset": 83,
                            "Line": 7,
                            "Column": 5
                          }
                        },
                        "Name": "print",
                        "_type": "Ident"
                      },
                      "Loc": {
                        "End": {
                          "Filename": "main.go",
                          "Offset": 98,
                          "Line": 7,
                          "Column": 20
                        },
                        "Start": {
                          "Filename": "main.go",
                          "Offset": 83,
                          "Line": 7,
                          "Column": 5
                        }
                      },
                      "Lparen": 89,
                      "Rparen": 98,
                      "_type": "CallExpr"
                    },
                    "_type": "ExprStmt"
                  },
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 112,
                        "Line": 8,
                        "Column": 14
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 103,
                        "Line": 8,
                        "Column": 5
                      }
                    },
                    "X": {
                      "Args": [
                        {
                          "Loc": {
                            "End": {
                              "Filename": "main.go",
                              "Offset": 111,
                              "Line": 8,
                              "Column": 13
                            },
                            "Start": {
                              "Filename": "main.go",
                              "Offset": 109,
                              "Line": 8,
                              "Column": 11
                            }
                          },
                          "Name": "id",
                          "_type": "Ident"
                        }
                      ],
                      "Ellipsis": 0,
                      "Fun": {
                        "Loc": {
                          "End": {
                            "Filename": "main.go",
                            "Offset": 108,
                            "Line": 8,
                            "Column": 10
                          },
                          "Start": {
                            "Filename": "main.go",
                            "Offset": 103,
                            "Line": 8,
                            "Column": 5
                          }
                        },
                        "Name": "print",
                        "_type": "Ident"
                      },
                      "Loc": {
                        "End": {
                          "Filename": "main.go",
                          "Offset": 112,
                          "Line": 8,
                          "Column": 14
                        },
                        "Start": {
                          "Filename": "main.go",
                          "Offset": 103,
                          "Line": 8,
                          "Column": 5
                        }
                      },
                      "Lparen": 109,
                      "Rparen": 112,
                      "_type": "CallExpr"
                    },
                    "_type": "ExprStmt"
                  },
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 125,
                        "Line": 9,
                        "Column": 13
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 117,
                        "Line": 9,
                        "Column": 5
                      }
                    },
                    "X": {
                      "Args": [
                        {
                          "Loc": {
                            "End": {
                              "Filename": "main.go",
                              "Offset": 124,
                              "Line": 9,
                              "Column": 12
                            },
                            "Start": {
                              "Filename": "main.go",
                              "Offset": 123,
                              "Line": 9,
                              "Column": 11
                            }
                          },
                          "Name": "i",
                          "_type": "Ident"
                        }
                      ],
                      "Ellipsis": 0,
                      "Fun": {
                        "Loc": {
                          "End": {
                            "Filename": "main.go",
                            "Offset": 122,
                            "Line": 9,
                            "Column": 10
                          },
                          "Start": {
                            "Filename": "main.go",
                            "Offset": 117,
                            "Line": 9,
                            "Column": 5
                          }
                        },
                        "Name": "print",
                        "_type": "Ident"
                      },
                      "Loc": {
                        "End": {
                          "Filename": "main.go",
                          "Offset": 125,
                          "Line": 9,
                          "Column": 13
                        },
                        "Start": {
                          "Filename": "main.go",
                          "Offset": 117,
                          "Line": 9,
                          "Column": 5
                        }
                      },
                      "Lparen": 123,
                      "Rparen": 125,
                      "_type": "CallExpr"
                    },
                    "_type": "ExprStmt"
                  }
                ],
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 129,
                    "Line": 10,
                    "Column": 4
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 77,
                    "Line": 6,
                    "Column": 26
                  }
                },
                "Rbrace": 129,
                "_type": "BlockStmt"
              },
              "Cond": {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 71,
                    "Line": 6,
                    "Column": 20
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 66,
                    "Line": 6,
                    "Column": 15
                  }
                },
                "Op": "<",
                "X": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 67,
                      "Line": 6,
                      "Column": 16
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 66,
                      "Line": 6,
                      "Column": 15
                    }
                  },
                  "Name": "i",
                  "_type": "Ident"
                },
                "Y": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 71,
                      "Line": 6,
                      "Column": 20
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 70,
                      "Line": 6,
                      "Column": 19
                    }
                  },
                  "Name": "y",
                  "_type": "Ident"
                },
                "_type": "BinaryExpr"
              },
              "For": 55,
              "Init": {
                "Lhs": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 59,
                        "Line": 6,
                        "Column": 8
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 58,
                        "Line": 6,
                        "Column": 7
                      }
                    },
                    "Name": "i",
                    "_type": "Ident"
                  }
                ],
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 64,
                    "Line": 6,
                    "Column": 13
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 58,
                    "Line": 6,
                    "Column": 7
                  }
                },
                "Rhs": [
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 64,
                        "Line": 6,
                        "Column": 13
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 63,
                        "Line": 6,
                        "Column": 12
                      }
                    },
                    "Value": "0",
                    "_type": "BasicLit"
                  }
                ],
                "Tok": ":=",
                "_type": "AssignStmt"
              },
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 129,
                  "Line": 10,
                  "Column": 4
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 54,
                  "Line": 6,
                  "Column": 3
                }
              },
              "Post": {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 76,
                    "Line": 6,
                    "Column": 25
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 73,
                    "Line": 6,
                    "Column": 22
                  }
                },
                "Tok": "++",
                "X": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 74,
                      "Line": 6,
                      "Column": 23
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 73,
                      "Line": 6,
                      "Column": 22
                    }
                  },
                  "Name": "i",
                  "_type": "Ident"
                },
                "_type": "IncDecStmt"
              },
              "_type": "ForStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 131,
              "Line": 11,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 50,
              "Line": 5,
              "Column": 23
            }
          },
          "Rbrace": 131,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 131,
            "Line": 11,
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
              "Offset": 34,
              "Line": 5,
              "Column": 7
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 33,
              "Line": 5,
              "Column": 6
            }
          },
          "Name": "f",
          "_type": "Ident"
        },
        "Type": {
          "Func": 29,
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 49,
              "Line": 5,
              "Column": 22
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 28,
              "Line": 5,
              "Column": 1
            }
          },
          "Params": {
            "Closing": 49,
            "List": [
              {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 41,
                    "Line": 5,
                    "Column": 14
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 35,
                    "Line": 5,
                    "Column": 8
                  }
                },
                "Names": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 37,
                        "Line": 5,
                        "Column": 10
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 35,
                        "Line": 5,
                        "Column": 8
                      }
                    },
                    "Name": "id",
                    "_type": "Ident"
                  }
                ],
                "Type": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 41,
                      "Line": 5,
                      "Column": 14
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 38,
                      "Line": 5,
                      "Column": 11
                    }
                  },
                  "Name": "int",
                  "_type": "Ident"
                },
                "_type": "Field"
              },
              {
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 48,
                    "Line": 5,
                    "Column": 21
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 43,
                    "Line": 5,
                    "Column": 16
                  }
                },
                "Names": [
                  {
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 44,
                        "Line": 5,
                        "Column": 17
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 43,
                        "Line": 5,
                        "Column": 16
                      }
                    },
                    "Name": "y",
                    "_type": "Ident"
                  }
                ],
                "Type": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 48,
                      "Line": 5,
                      "Column": 21
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 45,
                      "Line": 5,
                      "Column": 18
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
                "Offset": 49,
                "Line": 5,
                "Column": 22
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 34,
                "Line": 5,
                "Column": 7
              }
            },
            "Opening": 35,
            "_type": "FieldList"
          },
          "_type": "FuncType"
        },
        "_type": "FuncDecl"
      },
      {
        "Body": {
          "Lbrace": 146,
          "List": [
            {
              "Call": {
                "Args": [
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 155,
                        "Line": 14,
                        "Column": 9
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 154,
                        "Line": 14,
                        "Column": 8
                      }
                    },
                    "Value": "1",
                    "_type": "BasicLit"
                  },
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 160,
                        "Line": 14,
                        "Column": 14
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 157,
                        "Line": 14,
                        "Column": 11
                      }
                    },
                    "Value": "20",
                    "_type": "BasicLit"
                  }
                ],
                "Ellipsis": 0,
                "Fun": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 153,
                      "Line": 14,
                      "Column": 7
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 152,
                      "Line": 14,
                      "Column": 6
                    }
                  },
                  "Name": "f",
                  "_type": "Ident"
                },
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 161,
                    "Line": 14,
                    "Column": 15
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 152,
                    "Line": 14,
                    "Column": 6
                  }
                },
                "Lparen": 154,
                "Rparen": 161,
                "_type": "CallExpr"
              },
              "Go": 150,
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 161,
                  "Line": 14,
                  "Column": 15
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 149,
                  "Line": 14,
                  "Column": 3
                }
              },
              "_type": "GoStmt"
            },
            {
              "Call": {
                "Args": [
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 170,
                        "Line": 15,
                        "Column": 9
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 169,
                        "Line": 15,
                        "Column": 8
                      }
                    },
                    "Value": "2",
                    "_type": "BasicLit"
                  },
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 175,
                        "Line": 15,
                        "Column": 14
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 172,
                        "Line": 15,
                        "Column": 11
                      }
                    },
                    "Value": "20",
                    "_type": "BasicLit"
                  }
                ],
                "Ellipsis": 0,
                "Fun": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 168,
                      "Line": 15,
                      "Column": 7
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 167,
                      "Line": 15,
                      "Column": 6
                    }
                  },
                  "Name": "f",
                  "_type": "Ident"
                },
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 176,
                    "Line": 15,
                    "Column": 15
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 167,
                    "Line": 15,
                    "Column": 6
                  }
                },
                "Lparen": 169,
                "Rparen": 176,
                "_type": "CallExpr"
              },
              "Go": 165,
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 176,
                  "Line": 15,
                  "Column": 15
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 164,
                  "Line": 15,
                  "Column": 3
                }
              },
              "_type": "GoStmt"
            },
            {
              "Loc": {
                "End": {
                  "Filename": "main.go",
                  "Offset": 188,
                  "Line": 16,
                  "Column": 12
                },
                "Start": {
                  "Filename": "main.go",
                  "Offset": 179,
                  "Line": 16,
                  "Column": 3
                }
              },
              "X": {
                "Args": [
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 182,
                        "Line": 16,
                        "Column": 6
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 181,
                        "Line": 16,
                        "Column": 5
                      }
                    },
                    "Value": "0",
                    "_type": "BasicLit"
                  },
                  {
                    "Kind": "INT",
                    "Loc": {
                      "End": {
                        "Filename": "main.go",
                        "Offset": 187,
                        "Line": 16,
                        "Column": 11
                      },
                      "Start": {
                        "Filename": "main.go",
                        "Offset": 184,
                        "Line": 16,
                        "Column": 8
                      }
                    },
                    "Value": "20",
                    "_type": "BasicLit"
                  }
                ],
                "Ellipsis": 0,
                "Fun": {
                  "Loc": {
                    "End": {
                      "Filename": "main.go",
                      "Offset": 180,
                      "Line": 16,
                      "Column": 4
                    },
                    "Start": {
                      "Filename": "main.go",
                      "Offset": 179,
                      "Line": 16,
                      "Column": 3
                    }
                  },
                  "Name": "f",
                  "_type": "Ident"
                },
                "Loc": {
                  "End": {
                    "Filename": "main.go",
                    "Offset": 188,
                    "Line": 16,
                    "Column": 12
                  },
                  "Start": {
                    "Filename": "main.go",
                    "Offset": 179,
                    "Line": 16,
                    "Column": 3
                  }
                },
                "Lparen": 181,
                "Rparen": 188,
                "_type": "CallExpr"
              },
              "_type": "ExprStmt"
            }
          ],
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 190,
              "Line": 17,
              "Column": 2
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 145,
              "Line": 13,
              "Column": 13
            }
          },
          "Rbrace": 190,
          "_type": "BlockStmt"
        },
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 190,
            "Line": 17,
            "Column": 2
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 133,
            "Line": 13,
            "Column": 1
          }
        },
        "Name": {
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 142,
              "Line": 13,
              "Column": 10
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 138,
              "Line": 13,
              "Column": 6
            }
          },
          "Name": "main",
          "_type": "Ident"
        },
        "Type": {
          "Func": 134,
          "Loc": {
            "End": {
              "Filename": "main.go",
              "Offset": 144,
              "Line": 13,
              "Column": 12
            },
            "Start": {
              "Filename": "main.go",
              "Offset": 133,
              "Line": 13,
              "Column": 1
            }
          },
          "Params": {
            "Closing": 144,
            "List": [],
            "Loc": {
              "End": {
                "Filename": "main.go",
                "Offset": 144,
                "Line": 13,
                "Column": 12
              },
              "Start": {
                "Filename": "main.go",
                "Offset": 142,
                "Line": 13,
                "Column": 10
              }
            },
            "Opening": 143,
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
        "Offset": 190,
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
            "Offset": 41,
            "Line": 5,
            "Column": 14
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 38,
            "Line": 5,
            "Column": 11
          }
        },
        "Name": "int",
        "_type": "Ident"
      },
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 48,
            "Line": 5,
            "Column": 21
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 45,
            "Line": 5,
            "Column": 18
          }
        },
        "Name": "int",
        "_type": "Ident"
      },
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 88,
            "Line": 7,
            "Column": 10
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 83,
            "Line": 7,
            "Column": 5
          }
        },
        "Name": "print",
        "_type": "Ident"
      },
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 108,
            "Line": 8,
            "Column": 10
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 103,
            "Line": 8,
            "Column": 5
          }
        },
        "Name": "print",
        "_type": "Ident"
      },
      {
        "Loc": {
          "End": {
            "Filename": "main.go",
            "Offset": 122,
            "Line": 9,
            "Column": 10
          },
          "Start": {
            "Filename": "main.go",
            "Offset": 117,
            "Line": 9,
            "Column": 5
          }
        },
        "Name": "print",
        "_type": "Ident"
      }
    ],
    "_type": "File"
  }
`

const goroutine_inst = compile(stringToAst(goroutine_str))
debugCompile(goroutine_inst)
const vm = new GoVirtualMachine(goroutine_inst, false)
vm.run()