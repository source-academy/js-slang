import { Field, SpecNode, FuncDecl, LabeledStmt, AssignStmt, Ident } from './nodes'

export class Scope {
  Outer: Scope | null // outer scope
  Objects: Map<String, GoObject> // objects in scope

  constructor(parent?: Scope) {
    if (parent === undefined) {
      this.Outer = null
    } else {
      this.Outer = parent
    }
    this.Objects = new Map()
  }

  // Returns object with given name if found in scope,
  // otherwise returns null
  Lookup(name: string): GoObject | undefined {
    return this.Objects.get(name)
  }

  // Insert tries to insert named object obj into the current scope
  // If the scope already contains an object with the same name, the
  // previous object is returned, otherwise it inserts obj and returns undefined
  Insert(obj: GoObject): GoObject | undefined {
    const lookupObj = this.Lookup(obj.Name)
    if (lookupObj != undefined) {
      return lookupObj
    }
    this.Objects.set(obj.Name, obj)
    return undefined
  }
}

// GoObject describes named language entity e.g. constant, type, variable, function, methods, label
class GoObject {
  Kind: ObjKind // datatype of object
  Name: string // declared name
  Declaration!: Field | SpecNode | FuncDecl | LabeledStmt | AssignStmt | Scope | undefined
  Data!: any | undefined
  Type!: any | undefined

  constructor(kind: ObjKind, name: string) {
    this.Kind = kind
    this.Name = name
  }

  // Computes source position of object name
  Pos(): Pos.Pos {
    if (this.Declaration === undefined) {
      return Pos.NoPos
    }
    if ('Names' in this.Declaration) {
      // Field, ValueSpec
      for (var name of this.Declaration.Names) {
        if (name.Name === this.Name) {
          return name.Pos()
        }
      }
    }
    if ('Name' in this.Declaration) {
      // TypeSpec, FuncDecl
      if (this.Declaration.Name.Name === this.Name) {
        return this.Declaration.Name.Pos()
      }
    }
    if ('Label' in this.Declaration) {
      // LabeledStmt
      if (this.Declaration.Label.Name === this.Name) {
        return this.Declaration.Label.Pos()
      }
    }
    if ('LeftHandSide' in this.Declaration) {
      // AssignStmt
      for (var x of this.Declaration.LeftHandSide) {
        if ('NamePos' in x) {
          const ident = x as Ident
          return ident.Pos()
        }
      }
    }
    return Pos.NoPos
  }
}

type ObjKind = number

/* 
enum ObjKinds {
    Bad, // bad datatype
    Con, // constant
    Typ, // type
    Var, // variable
    Fun, // function/method
    Lbl, // label
}
*/

/*
const objKindStrings = [
    "bad",
    "const",
    "type",
    "var",
    "func",
    "label"
]

function getObjKindString(kind : ObjKind) : string {
    return objKindStrings[kind];
}
*/
