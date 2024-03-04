// Code taken from https://github.com/patternfly/patternfly-org/blob/main/packages/ast-helpers/acorn-typescript.js
// Some cases such as arrow function expressions are not properly handled
import { getLineInfo, Parser, tokTypes } from 'acorn'

// Taken from https://github.com/acornjs/acorn/blob/6770c2ecbf8e01470f6c9a2f59c786f014045baf/acorn/src/whitespace.js#L4C1-L5C1
const lineBreak = /\r\n?|\n|\u2028|\u2029/

class DestructuringErrors {
  shorthandAssign: number
  trailingComma: number
  parenthesizedAssign: number
  parenthesizedBind: number
  doubleProto: number
  constructor() {
    this.shorthandAssign =
      this.trailingComma =
      this.parenthesizedAssign =
      this.parenthesizedBind =
      this.doubleProto =
        -1
  }
}

const tsPredefinedType = {
  any: 'TSAnyKeyword',
  bigint: 'TSBigIntKeyword',
  boolean: 'TSBooleanKeyword',
  never: 'TSNeverKeyword',
  null: 'TSNullKeyword',
  number: 'TSNumberKeyword',
  object: 'TSObjectKeyword',
  string: 'TSStringKeyword',
  symbol: 'TSSymbolKeyword',
  undefined: 'TSUndefinedKeyword',
  unknown: 'TSUnknownKeyword',
  void: 'TSVoidKeyword'
}

const tsDeclaration = {
  interface: 1,
  type: 2,
  enum: 4,
  declare: 8
}

const tsTypeOperator = {
  typeof: 1,
  keyof: 2,
  infer: 4
}

const tsExprMarkup = {
  as: 1,
  '!': 2
}

const tsPlugin = (BaseParser: any) => {
  return class extends BaseParser {
    constructor(...args: any) {
      super(...args)
      // Allow 'interface'
      this.reservedWords = /^(?:enum)$/
      this.reservedWordsStrict = this.reservedWords
    }

    finishNode(node: any, type: string) {
      if (type.startsWith('TS')) {
        // Hack to not need acorn-walk to detect TS
        this.options.sourceType = 'ts'
      }
      return this.finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
    }

    computeLocByOffset(offset: any) {
      // If `locations` option is off, do nothing for saving performance.
      if (this.options.locations) {
        return getLineInfo(this.input, offset)
      } else {
        return
      }
    }

    startNodeAtNode(node: { start: any }) {
      return this.startNodeAt(node.start, this.computeLocByOffset(node.start))
    }

    tsPreparePreview() {
      const {
        pos,
        curLine,
        type,
        value,
        end,
        start,
        endLoc,
        startLoc,
        scopeStack,
        lastTokStartLoc,
        lastTokEndLoc,
        lastTokEnd,
        lastTokStart,
        context
      } = this
      return () => {
        this.pos = pos
        this.curLine = curLine
        this.type = type
        this.value = value
        this.end = end
        this.start = start
        this.endLoc = endLoc
        this.startLoc = startLoc
        this.scopeStack = scopeStack
        this.lastTokStartLoc = lastTokStartLoc
        this.lastTokEndLoc = lastTokEndLoc
        this.lastTokEnd = lastTokEnd
        this.lastTokStart = lastTokStart
        this.context = context
      }
    }

    _isStartOfTypeParameters() {
      return this.value && this.value.charCodeAt(0) === 60 // <
    }

    _isEndOfTypeParameters() {
      return this.value && this.value.charCodeAt(0) === 62 // >
    }

    _hasPrecedingLineBreak() {
      return lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
    }

    // Studied from Babel
    parseExpressionStatement(node: any, expr: any) {
      return expr.type === 'Identifier'
        ? this._parseTSDeclaration(node, expr)
        : super.parseExpressionStatement(node, expr)
    }

    parseBindingAtom() {
      const node = super.parseBindingAtom()
      if (this.eat(tokTypes.colon)) {
        node.typeAnnotation = this.parseTSTypeAnnotation(false)
        node.end = node.typeAnnotation.end
        if (this.options.locations) {
          node.loc.end = node.typeAnnotation.loc.end
        }
      }
      return node
    }

    parseMaybeDefault(
      startPos: any,
      startLoc: any,
      left: {
        optional: boolean
        typeAnnotation: { end: any; loc: { end: any } }
        end: any
        loc: { end: any }
      }
    ) {
      if (!left) {
        left = this.parseBindingAtom()
        if (this.eat(tokTypes.question)) {
          left.optional = true
        }
        // `parseBindingAtom` is executed,
        // so we need to check type annotation again.
        if (this.eat(tokTypes.colon)) {
          left.typeAnnotation = this.parseTSTypeAnnotation(false)
          left.end = left.typeAnnotation.end
          if (this.options.locations) {
            left.loc.end = left.typeAnnotation.loc.end
          }
        }
      }
      return super.parseMaybeDefault(startPos, startLoc, left)
    }

    parseMaybeAssign(
      noIn: boolean,
      refDestructuringErrors: any,
      afterLeftParse: (item: any) => any
    ) {
      let node = super.parseMaybeAssign(noIn, refDestructuringErrors, afterLeftParse)
      node = this._parseMaybeTSExpression(node)
      return node
    }

    parseFunctionParams(node: { typeParameters: any }) {
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      return super.parseFunctionParams(node)
    }

    parseFunctionBody(node: { returnType: any }, isArrowFunction: any) {
      // I know, return type doesn't belong to function body,
      // but this will be less hacky.
      if (this.eat(tokTypes.colon)) {
        node.returnType = this.parseTSTypeAnnotation(false)
      }
      super.parseFunctionBody(node, isArrowFunction)
    }

    parseParenAndDistinguishExpression(canBeArrow: any) {
      const startPos = this.start
      const startLoc = this.startLoc
      const allowTrailingComma = this.options.ecmaVersion >= 8
      let val
      if (this.options.ecmaVersion >= 6) {
        this.next()

        const innerStartPos = this.start,
          innerStartLoc = this.startLoc
        const exprList = []
        let first = true,
          lastIsComma = false
        const refDestructuringErrors = new DestructuringErrors(),
          oldYieldPos = this.yieldPos,
          oldAwaitPos = this.awaitPos
        let spreadStart
        this.yieldPos = 0
        this.awaitPos = 0
        // Do not save awaitIdentPos to allow checking awaits nested in parameters
        while (this.type !== tokTypes.parenR) {
          first ? (first = false) : this.expect(tokTypes.comma)
          if (allowTrailingComma && this.afterTrailingComma(tokTypes.parenR, true)) {
            lastIsComma = true
            break
          } else if (this.type === tokTypes.ellipsis) {
            spreadStart = this.start
            exprList.push(this.parseParenItem(this.parseRestBinding()))
            if (this.type === tokTypes.comma)
              this.raise(this.start, 'Comma is not permitted after the rest element')
            break
          } else {
            exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem))
          }
          if (this.type === tokTypes.colon) {
            this.parseTSTypeAnnotation() // Part I added
          }
        }
        const innerEndPos = this.start
        const innerEndLoc = this.startLoc
        this.expect(tokTypes.parenR)

        if (canBeArrow && !this.canInsertSemicolon()) {
          const branch = this._branch()
          try {
            if (branch.parseTSTypeAnnotation() && branch.eat(tokTypes.arrow)) {
              this.parseTSTypeAnnotation() // throw away type
            }
          } catch {}
          if (this.eat(tokTypes.arrow)) {
            this.checkPatternErrors(refDestructuringErrors, false)
            this.checkYieldAwaitInDefaultParams()
            this.yieldPos = oldYieldPos
            this.awaitPos = oldAwaitPos
            return this.parseParenArrowList(startPos, startLoc, exprList)
          }
        }

        if (!exprList.length || lastIsComma) this.unexpected(this.lastTokStart)
        if (spreadStart) this.unexpected(spreadStart)
        this.checkExpressionErrors(refDestructuringErrors, true)
        this.yieldPos = oldYieldPos || this.yieldPos
        this.awaitPos = oldAwaitPos || this.awaitPos

        if (exprList.length > 1) {
          val = this.startNodeAt(innerStartPos, innerStartLoc)
          val.expressions = exprList
          this.finishNodeAt(val, 'SequenceExpression', innerEndPos, innerEndLoc)
        } else {
          val = exprList[0]
        }
      } else {
        val = this.parseParenExpression()
      }

      if (this.options.preserveParens) {
        const par = this.startNodeAt(startPos, startLoc)
        par.expression = val
        return this.finishNode(par, 'ParenthesizedExpression')
      } else {
        return val
      }
    }

    // Fix ambiguity between BinaryExpressions and TSCallExpressions
    parseSubscript(base: { typeParameters: any }) {
      const branch = this._branch()
      if (this._isStartOfTypeParameters()) {
        // <
        try {
          // will throw if no matching >
          const typeParameters = branch.parseTSTypeParameterInstantiation()
          if (typeParameters && branch.eat(tokTypes.parenL)) {
            // Update parser to match branch
            base.typeParameters = this.parseTSTypeParameterInstantiation()
          }
        } catch {}
      }

      return super.parseSubscript.apply(this, arguments)
    }

    parseExpression() {
      const parenthesized = this.type === tokTypes.parenL,
        parenStart = parenthesized ? this.start : -1
      let expr = super.parseExpression()

      if (parenthesized) {
        expr.extra = { parenthesized, parenStart }
        return expr
      }

      expr = this._parseMaybeTSExpression(expr)
      return expr
    }

    parseParenItem(item: any) {
      item = super.parseParenItem(item)
      item = this._parseMaybeTSExpression(item)
      return item
    }

    parseTSTypeAnnotation(eatColon = true) {
      eatColon && this.expect(tokTypes.colon)
      const node = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc)
      this._parseTSTypeAnnotation(node)
      return this.finishNode(node, 'TSTypeAnnotation')
    }

    _parseTSType() {
      const node = this._parseNonConditionalType()
      if (this.type === tokTypes._extends && !this._hasPrecedingLineBreak()) {
        return this.parseTSConditionalType(node)
      }
      return node
    }

    _parseTSTypeAnnotation(node: { typeAnnotation: any }) {
      node.typeAnnotation = this._parseTSType()
    }

    _parsePrimaryType() {
      let node
      switch (this.type) {
        case tokTypes.name:
          node =
            this.value in tsPredefinedType
              ? this.parseTSPredefinedType()
              : this.parseTSTypeReference()
          break
        case tokTypes.braceL:
          node = this.parseTSTypeLiteral()
          break
        case tokTypes._void:
        case tokTypes._null:
          node = this.parseTSPredefinedType()
          break
        case tokTypes.parenL:
          node = this.parseTSParenthesizedType()
          break
        case tokTypes.bracketL:
          node = this.parseTSTupleType()
          break
        case tokTypes.num:
        case tokTypes.string:
        case tokTypes._true:
        case tokTypes._false:
          node = this.parseTSLiteralType(this.type)
          break
        case tokTypes._import:
          node = this.parseTSImportType(false)
          break
        default:
          return
      }

      while (this.type === tokTypes.bracketL) {
        node = this._parseMaybeTSArrayType(node)
      }

      return node
    }

    _parseNonConditionalType() {
      let node
      switch (this.type) {
        case tokTypes.name:
          switch (tsTypeOperator[this.value]) {
            case tsTypeOperator.infer:
              node = this.parseTSInferType()
              break
            case tsTypeOperator.keyof:
              node = this.parseTSKeyofType()
              break
            default:
              node = this._parseTSUnionTypeOrIntersectionType()
          }
          break
        case tokTypes._new:
          node = this.parseTSConstructorType()
          break
        case tokTypes.parenL:
          const recover = this.tsPreparePreview()
          const isStartOfTSFunctionType = this._isStartOfTSFunctionType()
          recover()
          node = isStartOfTSFunctionType
            ? this.parseTSFunctionType()
            : this.parseTSParenthesizedType()
          break
        case tokTypes.relational:
          node = this._isStartOfTypeParameters() ? this.parseTSFunctionType() : this.unexpected()
          break
        case tokTypes._typeof:
          node = this.parseTSTypeofType()
          break
        default:
          node = this._parseTSUnionTypeOrIntersectionType()
          break
      }
      return node || this.unexpected()
    }

    _parseTSDeclaration(node: any, expr: { name: string | number }) {
      const val = tsDeclaration[expr.name]
      switch (val) {
        case tsDeclaration.interface:
          if (this.type === tokTypes.name) {
            return this.parseTSInterfaceDeclaration()
          }
          break
        case tsDeclaration.type:
          if (this.type === tokTypes.name) {
            return this.parseTSTypeAliasDeclaration()
          }
          break
        default:
          break
      }
      return super.parseExpressionStatement(node, expr)
    }

    parseTSTypeReference() {
      const node = this.startNode()
      let typeName = this.parseIdent()
      if (this.type === tokTypes.dot) {
        typeName = this.parseTSQualifiedName(typeName)
      }
      node.typeName = typeName
      if (this._isStartOfTypeParameters()) {
        node.typeParameters = this.parseTSTypeParameterInstantiation()
      }
      this.finishNode(node, 'TSTypeReference')
      return node
    }

    parseTSPredefinedType() {
      const node = this.startNode()
      const keyword = this.value
      this.next()
      this.finishNode(node, tsPredefinedType[keyword])
      return node
    }

    parseTSLiteralType(tokType: any) {
      const node = this.startNode()
      const literal = this.parseLiteral(this.value)
      if (tokType === tokTypes._true || tokType === tokTypes._false) {
        literal.value = tokType === tokTypes._true
      }
      node.literal = literal
      return this.finishNode(node, 'TSLiteralType')
    }

    parseTSTupleType() {
      const node = this.startNode()
      const elementTypes = []
      this.eat(tokTypes.bracketL)
      let first = true
      while (!this.eat(tokTypes.bracketR)) {
        first ? (first = false) : this.expect(tokTypes.comma)
        switch (this.type) {
          case tokTypes.name:
            const elem = this.parseTSTypeReference()
            if (this.type === tokTypes.question) {
              elementTypes.push(this.parseTSOptionalType(elem))
            } else {
              elementTypes.push(elem)
            }
            break
          case tokTypes.ellipsis:
            elementTypes.push(this.parseTSRestType())
            break
          case tokTypes.bracketR:
            break
          default:
            this.unexpected()
        }
      }
      node.elementTypes = elementTypes
      return this.finishNode(node, 'TSTupleType')
    }

    parseTSOptionalType(typeRef: any) {
      const node = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc)
      this.expect(tokTypes.question)
      node.typeAnnotation = typeRef
      return this.finishNode(node, 'TSOptionalType')
    }

    parseTSRestType() {
      const node = this.startNode()
      this.expect(tokTypes.ellipsis)
      this._parseTSTypeAnnotation(node)
      return this.finishNode(node, 'TSRestType')
    }

    _parseMaybeTSArrayType(prev: any): any {
      const node = this.startNodeAtNode(prev)
      this.expect(tokTypes.bracketL)
      if (this.eat(tokTypes.bracketR)) {
        return this.parseTSArrayType(node, prev)
      }
      return this.parseTSIndexedAccessType(node, prev)
    }

    parseTSArrayType(node: { elementType: any }, elementType: any) {
      node.elementType = elementType
      return this.finishNode(node, 'TSArrayType')
    }

    parseTSIndexedAccessType(node: { objectType: any; indexType: any }, objectType: any) {
      node.objectType = objectType
      node.indexType = this._parseTSType()
      this.expect(tokTypes.bracketR)
      if (this.type === tokTypes.bracketL) {
        return this._parseMaybeTSArrayType(node)
      }
      return this.finishNode(node, 'TSIndexedAccessType')
    }

    _isStartOfTSFunctionType() {
      this.nextToken()
      switch (this.type) {
        case tokTypes.parenR:
        case tokTypes.ellipsis:
          return true
        case tokTypes.name:
        case tokTypes._this:
          this.nextToken()
          switch (this.type) {
            case tokTypes.colon:
            case tokTypes.comma:
            case tokTypes.question:
              return true
            case tokTypes.parenR:
              this.nextToken()
              return this.type === tokTypes.arrow
            default:
              return false
          }
        case tokTypes.braceL:
        case tokTypes.bracketL:
          this.type === tokTypes.braceL
            ? this.parseObj(/* isPattern */ true)
            : this.parseBindingAtom()
          switch (this.type) {
            case tokTypes.colon:
            case tokTypes.comma:
            case tokTypes.question:
              return true
            case tokTypes.parenR:
              this.nextToken()
              return this.type === tokTypes.arrow
            default:
              return false
          }
        default:
          return false
      }
    }

    parseTSFunctionType() {
      const node = this.startNode()
      const temp = Object.create(null)
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      this.parseFunctionParams(temp)
      node.parameters = temp.params
      this.expect(tokTypes.arrow)
      node.typeAnnotation = this.parseTSTypeAnnotation(false)
      return this.finishNode(node, 'TSFunctionType')
    }

    parseTSParenthesizedType() {
      const node = this.startNode()
      this.expect(tokTypes.parenL)
      this._parseTSTypeAnnotation(node)
      this.expect(tokTypes.parenR)
      while (this.eat(tokTypes.bracketL)) {
        this.expect(tokTypes.bracketR)
      }
      return this.finishNode(node, 'TSParenthesizedType')
    }

    parseTSUnionType(first: any) {
      const node = first ? this.startNodeAtNode(first) : this.startNode()
      const types = []
      first && types.push(first)
      while (this.eat(tokTypes.bitwiseOR)) {
        types.push(this._parseTSIntersectionTypeOrPrimaryType())
      }
      if (types.length === 1) {
        return first
      }
      node.types = types
      return this.finishNode(node, 'TSUnionType')
    }

    parseTSIntersectionType(first: any) {
      const node = first ? this.startNodeAtNode(first) : this.startNode()
      const types = []
      first && types.push(first)
      while (this.eat(tokTypes.bitwiseAND)) {
        types.push(this._parsePrimaryType())
      }
      if (types.length === 1) {
        return first
      }
      node.types = types
      return this.finishNode(node, 'TSIntersectionType')
    }

    _parseTSIntersectionTypeOrPrimaryType() {
      this.eat(tokTypes.bitwiseAND)
      const node = this._parsePrimaryType()
      if (this.type === tokTypes.bitwiseAND) {
        return this.parseTSIntersectionType(node)
      }
      return node
    }

    _parseTSUnionTypeOrIntersectionType() {
      this.eat(tokTypes.bitwiseOR)
      const node = this._parseTSIntersectionTypeOrPrimaryType()
      if (this.type === tokTypes.bitwiseOR) {
        return this.parseTSUnionType(node)
      }
      return node
    }

    parseTSConditionalType(checkType: any) {
      const node = this.startNodeAtNode(checkType)
      node.checkType = checkType
      this.expect(tokTypes._extends)
      node.extendsType = this._parseNonConditionalType()
      this.expect(tokTypes.question)
      node.trueType = this._parseNonConditionalType()
      this.expect(tokTypes.colon)
      node.falseType = this._parseNonConditionalType()
      return this.finishNode(node, 'TSConditionalType')
    }

    parseTSInferType() {
      const node = this.startNode()
      this.next()
      node.typeParameter = this.parseTSTypeParameter()
      return this.finishNode(node, 'TSInferType')
    }

    parseTSKeyofType() {
      const node = this.startNode()
      this.next()
      node.typeAnnotation = this.parseTSTypeAnnotation(false)
      return this.finishNode(node, 'TSTypeOperator')
    }

    parseTSTypeQuery() {
      const node = this.startNode()
      this.next()
      node.exprName = this.parseIdent()
      return this.finishNode(node, 'TSTypeQuery')
    }

    parseTSTypeofType() {
      const typeQuery = this.parseTSTypeQuery()
      if (this.eat(tokTypes.bracketL)) {
        const node = this.startNode()
        return this.parseTSIndexedAccessType(node, typeQuery)
      }
      return typeQuery
    }

    parseTSImportType(isTypeOf: boolean) {
      const node = this.startNode()
      node.isTypeOf = isTypeOf
      this.expect(tokTypes._import)
      this.expect(tokTypes.parenL)
      node.parameter = this.parseTSLiteralType(this.type)
      this.expect(tokTypes.parenR)
      if (this.eat(tokTypes.dot)) {
        let qualifier = this.parseIdent()
        if (this.type === tokTypes.dot) {
          qualifier = this.parseTSQualifiedName(qualifier)
        }
        node.qualifier = qualifier
      }
      return this.finishNode(node, 'TSImportType')
    }

    parseTSQualifiedName(left: any) {
      let node = this.startNodeAtNode(left)
      node.left = left
      this.expect(tokTypes.dot)
      node.right = this.parseIdent()
      node = this.finishNode(node, 'TSQualifiedName')
      if (this.type === tokTypes.dot) {
        node = this.parseTSQualifiedName(node)
      }
      return node
    }

    parseTSConstructorType() {
      const node = this.startNode()
      this.expect(tokTypes._new)
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      this.expect(tokTypes.parenL)
      node.parameters = this.parseBindingList(tokTypes.parenR, false, this.options.ecmaVersion >= 8)
      this.expect(tokTypes.arrow)
      node.typeAnnotation = this.parseTSTypeAnnotation(false)
      return this.finishNode(node, 'TSConstructorType')
    }

    parseTSConstructSignatureDeclaration() {
      const node = this.startNode()
      this.expect(tokTypes._new)
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      this.expect(tokTypes.parenL)
      node.parameters = this.parseBindingList(tokTypes.parenR, false, this.options.ecmaVersion >= 8)
      if (this.eat(tokTypes.colon)) {
        node.typeAnnotation = this.parseTSTypeAnnotation(false)
      }
      return this.finishNode(node, 'TSConstructSignatureDeclaration')
    }

    parseTSTypeLiteral() {
      return this._parseObjectLikeType('TSTypeLiteral', 'members')
    }

    parseTSTypeAliasDeclaration() {
      const node = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc)
      node.id = this.parseIdent()
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      this.expect(tokTypes.eq)
      this._parseTSTypeAnnotation(node)
      this.semicolon()
      return this.finishNode(node, 'TSTypeAliasDeclaration')
    }

    parseTSInterfaceDeclaration() {
      const node = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc)
      node.id = this.parseIdent()
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      if (this.eat(tokTypes._extends)) {
        const heritage = []
        do {
          heritage.push(this.parseTSExpressionWithTypeArguments())
        } while (this.eat(tokTypes.comma))
        node.heritage = heritage
      }
      node.body = this._parseObjectLikeType('TSInterfaceBody', 'body')
      this.semicolon()
      return this.finishNode(node, 'TSInterfaceDeclaration')
    }

    parseTSExpressionWithTypeArguments() {
      const node = this.startNode()
      let expr = this.parseIdent()
      if (this.eat(tokTypes.dot)) {
        expr = this.parseTSQualifiedName(expr)
      }
      node.expr = expr
      if (this._isStartOfTypeParameters()) {
        const typeParameters = this.parseTSTypeParameterInstantiation()
        node.typeParameters = typeParameters
        node.end = typeParameters.end
        if (this.options.locations) {
          node.loc.end = typeParameters.loc.end
        }
      }
      return this.finishNode(node, 'TSExpressionWithTypeArguments')
    }

    parseTSTypeParameter() {
      const node = this.startNode()
      if (this.type === tokTypes.name) {
        node.name = this.value
        this.next()
      } else {
        this.unexpected()
      }
      if (this.eat(tokTypes._extends)) {
        node.constraint = this._parseTSType()
      }
      if (this.eat(tokTypes.eq)) {
        node.default = this._parseTSType()
      }
      return this.finishNode(node, 'TSTypeParameter')
    }

    parseMaybeTSTypeParameterDeclaration() {
      if (this._isStartOfTypeParameters()) {
        const node = this.startNode()
        const params = []
        let first = true
        this.next()
        while (!this.eat(tokTypes.relational)) {
          first ? (first = false) : this.expect(tokTypes.comma)
          if (this._isEndOfTypeParameters()) {
            break
          }
          params.push(this.parseTSTypeParameter())
        }
        node.params = params
        return this.finishNode(node, 'TSTypeParameterDeclaration')
      }
    }

    parseTSTypeParameterInstantiation() {
      const node = this.startNode()
      const params = []
      this.next() // <
      let first = true
      while ((this.value && !this._isEndOfTypeParameters()) || this.type === tokTypes.comma) {
        first ? (first = false) : this.expect(tokTypes.comma)

        params.push(this._parseTSType())
      }
      if (this._isEndOfTypeParameters()) {
        if (this.value.length > 1) {
          this.value = this.value.slice(1) // Fix to allow chaining of type parameters
        } else {
          this.next() // >
        }
      }
      node.params = params
      return this.finishNode(node, 'TSTypeParameterInstantiation')
    }

    parseMaybeTSTypeParameterInstantiation() {
      if (this._isStartOfTypeParameters()) {
        return this.parseTSTypeParameterInstantiation()
      }
    }

    _parseObjectLikeType(kind: string, prop: string) {
      const node = this.startNode()
      this.expect(tokTypes.braceL)
      const list = []
      while (!this.eat(tokTypes.braceR)) {
        switch (this.type) {
          case tokTypes.name:
            const key = this.parseIdent()
            switch (this.type) {
              case tokTypes.parenL:
              case tokTypes.relational:
                list.push(this.parseTSMethodSignature(key))
                break
              case tokTypes.colon:
              case tokTypes.semi:
              case tokTypes.comma:
              case tokTypes.braceR:
              case tokTypes.question:
                list.push(this.parseTSPropertySignature(key))
                break
              default:
                if (this._hasPrecedingLineBreak()) {
                  list.push(this.parseTSPropertySignature(key))
                  continue
                }
                this.unexpected()
            }
            break
          case tokTypes.bracketL:
            const recover = this.tsPreparePreview()
            this.nextToken()
            if (this.type === tokTypes.name) {
              this.nextToken()
              switch (this.type) {
                case tokTypes.colon:
                  recover()
                  list.push(this.parseTSIndexSignature())
                  break
                case tokTypes._in:
                  if (list.length === 0) {
                    recover()
                    return this.parseTSMappedType()
                  } else {
                    recover()
                    list.push(this.parseTSPropertySignature(null, true))
                  }
                  break
                default:
                  recover()
                  list.push(this.parseTSPropertySignature(null, true))
              }
            } else {
              recover()
              list.push(this.parseTSPropertySignature(null, true))
            }
            break
          case tokTypes._new:
            list.push(this.parseTSConstructSignatureDeclaration())
            break
          default:
            this.unexpected()
        }
      }
      node[prop] = list
      return this.finishNode(node, kind)
    }

    parseTSMethodSignature(key: any) {
      const node = this.startNodeAtNode(key)
      node.key = key
      if (this.eat(tokTypes.question)) {
        node.optional = true
      }
      node.typeParameters = this.parseMaybeTSTypeParameterDeclaration()
      this.expect(tokTypes.parenL)
      node.parameters = this.parseBindingList(tokTypes.parenR, false, this.options.ecmaVersion >= 8)
      if (this.type === tokTypes.colon) {
        node.typeAnnotation = this.parseTSTypeAnnotation(true)
      }
      this.eat(tokTypes.comma) || this.eat(tokTypes.semi)
      return this.finishNode(node, 'TSMethodSignature')
    }

    parseTSPropertySignature(key: any, computed = false) {
      let node
      if (computed) {
        node = this.startNode()
        this.expect(tokTypes.bracketL)
        node.key = this.parseExpression()
        this.expect(tokTypes.bracketR)
      } else {
        node = this.startNodeAtNode(key)
        node.key = key
      }
      node.computed = computed
      if (this.eat(tokTypes.question)) {
        node.optional = true
      }
      if (this.type === tokTypes.colon) {
        node.typeAnnotation = this.parseTSTypeAnnotation(true)
      }
      this.eat(tokTypes.comma) || this.eat(tokTypes.semi)
      return this.finishNode(node, 'TSPropertySignature')
    }

    parseTSIndexSignature() {
      const node = this.startNode()
      this.expect(tokTypes.bracketL)
      const index = this.parseIdent()
      index.typeAnnotation = this.parseTSTypeAnnotation(true)
      index.end = index.typeAnnotation.end
      if (this.options.locations) {
        index.loc.end = index.typeAnnotation.loc.end
      }
      node.index = index
      this.expect(tokTypes.bracketR)
      node.typeAnnotation = this.parseTSTypeAnnotation(true)
      this.eat(tokTypes.comma) || this.eat(tokTypes.semi)
      return this.finishNode(node, 'TSIndexSignature')
    }

    parseTSMappedType() {
      const node = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc)
      this.expect(tokTypes.bracketL)
      node.typeParameter = this._parseTSTypeParameterInTSMappedType()
      this.expect(tokTypes.bracketR)
      if (this.eat(tokTypes.question)) {
        node.optional = true
      }
      if (this.type === tokTypes.colon) {
        node.typeAnnotation = this.parseTSTypeAnnotation(true)
      }
      this.semicolon()
      this.expect(tokTypes.braceR)
      return this.finishNode(node, 'TSMappedType')
    }

    _parseTSTypeParameterInTSMappedType() {
      const node = this.startNode()
      if (this.type === tokTypes.name) {
        node.name = this.value
        this.next()
      } else {
        this.unexpected()
      }
      this.expect(tokTypes._in)
      node.constraint = this._parseNonConditionalType()
      return this.finishNode(node, 'TSTypeParameter')
    }

    _parseMaybeTSExpression(node: any) {
      if (this.type === tokTypes.prefix && tsExprMarkup[this.value] === tsExprMarkup['!']) {
        node = this.parseTSNonNullExpression(node)
      }
      if (this.type === tokTypes.name && tsExprMarkup[this.value] === tsExprMarkup.as) {
        node = this.parseTSAsExpression(node)
      }
      return node
    }

    parseTSAsExpression(expression: any) {
      let node = expression
      while (this.type === tokTypes.name && tsExprMarkup[this.value] === tsExprMarkup.as) {
        const _node = this.startNodeAtNode(node)
        this.next()
        _node.expression = node
        this._parseTSTypeAnnotation(_node)
        node = this.finishNode(_node, 'TSAsExpression')
      }
      return expression
    }

    parseTSNonNullExpression(expression: any) {
      let node = expression
      while (this.type === tokTypes.prefix && tsExprMarkup[this.value] === tsExprMarkup['!']) {
        const _node = this.startNodeAtNode(node)
        _node.expression = node
        this.next()
        node = this.finishNode(_node, 'TSNonNullExpression')
      }
      return node
    }
  }
}

// acorn-class-fields plugin is needed, else parsing of some function types will not work
const TypeParser = Parser.extend(tsPlugin as any, require('acorn-class-fields'))

export default TypeParser
