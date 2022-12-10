// Clone of estree library, with modifications that add type syntax support.
import * as es from 'estree'

interface BaseNodeWithoutComments {
  // Every leaf interface that extends BaseNode must specify a type property.
  // The type property should be a string literal. For example, Identifier
  // has: `type: "Identifier"`
  type: string
  loc?: es.SourceLocation | null | undefined
  range?: [number, number] | undefined
}

interface BaseNode extends BaseNodeWithoutComments {
  leadingComments?: Array<Comment> | undefined
  trailingComments?: Array<Comment> | undefined
}

// Added to support type syntax
interface BaseNodeWithTypeAnnotation extends BaseNode {
  typeAnnotation?: AnnotationTypeNode
  returnType?: AnnotationTypeNode
}

interface NodeMap {
  AssignmentProperty: AssignmentProperty
  CatchClause: CatchClause
  Class: Class
  ClassBody: ClassBody
  Expression: Expression
  Function: Function
  Identifier: Identifier
  Literal: Literal
  MethodDefinition: MethodDefinition
  ModuleDeclaration: ModuleDeclaration
  ModuleSpecifier: ModuleSpecifier
  Pattern: Pattern
  PrivateIdentifier: PrivateIdentifier
  Program: Program
  Property: Property
  PropertyDefinition: PropertyDefinition
  SpreadElement: SpreadElement
  Statement: Statement
  Super: Super
  SwitchCase: SwitchCase
  TemplateElement: TemplateElement
  VariableDeclarator: VariableDeclarator
}

export type Node = NodeMap[keyof NodeMap]

export interface Comment extends BaseNodeWithoutComments {
  type: 'Line' | 'Block'
  value: string
}

export interface Position {
  /** >= 1 */
  line: number
  /** >= 0 */
  column: number
}

export interface Program extends BaseNodeWithTypeAnnotation {
  type: 'Program'
  sourceType: 'script' | 'module'
  body: Array<Directive | Statement | ModuleDeclaration>
  comments?: Array<Comment> | undefined
}

export interface Directive extends BaseNodeWithTypeAnnotation {
  type: 'ExpressionStatement'
  expression: Literal
  directive: string
}

interface BaseFunction extends BaseNodeWithTypeAnnotation {
  params: Array<Pattern>
  generator?: boolean | undefined
  async?: boolean | undefined
  // The body is either BlockStatement or Expression because arrow functions
  // can have a body that's either. FunctionDeclarations and
  // FunctionExpressions have only BlockStatement bodies.
  body: BlockStatement | Expression
}

export type Function = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression

export type Statement =
  | ExpressionStatement
  | BlockStatement
  | StaticBlock
  | EmptyStatement
  | DebuggerStatement
  | WithStatement
  | ReturnStatement
  | LabeledStatement
  | BreakStatement
  | ContinueStatement
  | IfStatement
  | SwitchStatement
  | ThrowStatement
  | TryStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | ForInStatement
  | ForOfStatement
  | Declaration

type BaseStatement = BaseNodeWithTypeAnnotation

export interface EmptyStatement extends BaseStatement {
  type: 'EmptyStatement'
}

export interface BlockStatement extends BaseStatement {
  type: 'BlockStatement'
  body: Array<Statement>
  innerComments?: Array<Comment> | undefined
}

export interface StaticBlock extends Omit<BlockStatement, 'type'> {
  type: 'StaticBlock'
}

export interface ExpressionStatement extends BaseStatement {
  type: 'ExpressionStatement'
  expression: Expression
}

export interface IfStatement extends BaseStatement {
  type: 'IfStatement'
  test: Expression
  consequent: Statement
  alternate?: Statement | null | undefined
}

export interface LabeledStatement extends BaseStatement {
  type: 'LabeledStatement'
  label: Identifier
  body: Statement
}

export interface BreakStatement extends BaseStatement {
  type: 'BreakStatement'
  label?: Identifier | null | undefined
}

export interface ContinueStatement extends BaseStatement {
  type: 'ContinueStatement'
  label?: Identifier | null | undefined
}

export interface WithStatement extends BaseStatement {
  type: 'WithStatement'
  object: Expression
  body: Statement
}

export interface SwitchStatement extends BaseStatement {
  type: 'SwitchStatement'
  discriminant: Expression
  cases: Array<SwitchCase>
}

export interface ReturnStatement extends BaseStatement {
  type: 'ReturnStatement'
  argument?: Expression | null | undefined
}

export interface ThrowStatement extends BaseStatement {
  type: 'ThrowStatement'
  argument: Expression
}

export interface TryStatement extends BaseStatement {
  type: 'TryStatement'
  block: BlockStatement
  handler?: CatchClause | null | undefined
  finalizer?: BlockStatement | null | undefined
}

export interface WhileStatement extends BaseStatement {
  type: 'WhileStatement'
  test: Expression
  body: Statement
}

export interface DoWhileStatement extends BaseStatement {
  type: 'DoWhileStatement'
  body: Statement
  test: Expression
}

export interface ForStatement extends BaseStatement {
  type: 'ForStatement'
  init?: VariableDeclaration | Expression | null | undefined
  test?: Expression | null | undefined
  update?: Expression | null | undefined
  body: Statement
}

interface BaseForXStatement extends BaseStatement {
  left: VariableDeclaration | Pattern
  right: Expression
  body: Statement
}

export interface ForInStatement extends BaseForXStatement {
  type: 'ForInStatement'
}

export interface DebuggerStatement extends BaseStatement {
  type: 'DebuggerStatement'
}

export type Declaration = FunctionDeclaration | VariableDeclaration | ClassDeclaration

type BaseDeclaration = BaseStatement

export interface FunctionDeclaration extends BaseFunction, BaseDeclaration {
  type: 'FunctionDeclaration'
  /** It is null when a function declaration is a part of the `export default function` statement */
  id: Identifier | null
  body: BlockStatement
}

export interface VariableDeclaration extends BaseDeclaration {
  type: 'VariableDeclaration'
  declarations: Array<VariableDeclarator>
  kind: 'var' | 'let' | 'const'
}

export interface VariableDeclarator extends BaseNodeWithTypeAnnotation {
  type: 'VariableDeclarator'
  id: Pattern
  init?: Expression | null | undefined
}

export interface ExpressionMap {
  ArrayExpression: ArrayExpression
  ArrowFunctionExpression: ArrowFunctionExpression
  AssignmentExpression: AssignmentExpression
  AwaitExpression: AwaitExpression
  BinaryExpression: BinaryExpression
  CallExpression: CallExpression
  ChainExpression: ChainExpression
  ClassExpression: ClassExpression
  ConditionalExpression: ConditionalExpression
  FunctionExpression: FunctionExpression
  Identifier: Identifier
  ImportExpression: ImportExpression
  Literal: Literal
  LogicalExpression: LogicalExpression
  MemberExpression: MemberExpression
  MetaProperty: MetaProperty
  NewExpression: NewExpression
  ObjectExpression: ObjectExpression
  SequenceExpression: SequenceExpression
  TaggedTemplateExpression: TaggedTemplateExpression
  TemplateLiteral: TemplateLiteral
  ThisExpression: ThisExpression
  UnaryExpression: UnaryExpression
  UpdateExpression: UpdateExpression
  YieldExpression: YieldExpression
}

type Expression = ExpressionMap[keyof ExpressionMap]

export type BaseExpression = BaseNodeWithTypeAnnotation

type ChainElement = SimpleCallExpression | MemberExpression

export interface ChainExpression extends BaseExpression {
  type: 'ChainExpression'
  expression: ChainElement
}

export interface ThisExpression extends BaseExpression {
  type: 'ThisExpression'
}

export interface ArrayExpression extends BaseExpression {
  type: 'ArrayExpression'
  elements: Array<Expression | SpreadElement | null>
}

export interface ObjectExpression extends BaseExpression {
  type: 'ObjectExpression'
  properties: Array<Property | SpreadElement>
}

export interface PrivateIdentifier extends BaseNodeWithTypeAnnotation {
  type: 'PrivateIdentifier'
  name: string
}

export interface Property extends BaseNodeWithTypeAnnotation {
  type: 'Property'
  key: Expression | PrivateIdentifier
  value: Expression | Pattern // Could be an AssignmentProperty
  kind: 'init' | 'get' | 'set'
  method: boolean
  shorthand: boolean
  computed: boolean
}

export interface PropertyDefinition extends BaseNodeWithTypeAnnotation {
  type: 'PropertyDefinition'
  key: Expression | PrivateIdentifier
  value?: Expression | null | undefined
  computed: boolean
  static: boolean
}

export interface FunctionExpression extends BaseFunction, BaseExpression {
  id?: Identifier | null | undefined
  type: 'FunctionExpression'
  body: BlockStatement
}

export interface SequenceExpression extends BaseExpression {
  type: 'SequenceExpression'
  expressions: Array<Expression>
}

export interface UnaryExpression extends BaseExpression {
  type: 'UnaryExpression'
  operator: UnaryOperator
  prefix: true
  argument: Expression
}

export interface BinaryExpression extends BaseExpression {
  type: 'BinaryExpression'
  operator: BinaryOperator
  left: Expression
  right: Expression
}

export interface AssignmentExpression extends BaseExpression {
  type: 'AssignmentExpression'
  operator: AssignmentOperator
  left: Pattern | MemberExpression
  right: Expression
}

export interface UpdateExpression extends BaseExpression {
  type: 'UpdateExpression'
  operator: UpdateOperator
  argument: Expression
  prefix: boolean
}

export interface LogicalExpression extends BaseExpression {
  type: 'LogicalExpression'
  operator: LogicalOperator
  left: Expression
  right: Expression
}

export interface ConditionalExpression extends BaseExpression {
  type: 'ConditionalExpression'
  test: Expression
  alternate: Expression
  consequent: Expression
}

interface BaseCallExpression extends BaseExpression {
  callee: Expression | Super
  arguments: Array<Expression | SpreadElement>
}
export type CallExpression = SimpleCallExpression | NewExpression

export interface SimpleCallExpression extends BaseCallExpression {
  type: 'CallExpression'
  optional: boolean
}

export interface NewExpression extends BaseCallExpression {
  type: 'NewExpression'
}

export interface MemberExpression extends BaseExpression, BasePattern {
  type: 'MemberExpression'
  object: Expression | Super
  property: Expression | PrivateIdentifier
  computed: boolean
  optional: boolean
}

export type Pattern =
  | Identifier
  | ObjectPattern
  | ArrayPattern
  | RestElement
  | AssignmentPattern
  | MemberExpression

type BasePattern = BaseNodeWithTypeAnnotation

export interface SwitchCase extends BaseNodeWithTypeAnnotation {
  type: 'SwitchCase'
  test?: Expression | null | undefined
  consequent: Array<Statement>
}

export interface CatchClause extends BaseNodeWithTypeAnnotation {
  type: 'CatchClause'
  param: Pattern | null
  body: BlockStatement
}

export interface Identifier extends BaseNodeWithTypeAnnotation, BaseExpression, BasePattern {
  type: 'Identifier'
  name: string
}

export type Literal = SimpleLiteral | RegExpLiteral | BigIntLiteral

export interface SimpleLiteral extends BaseNodeWithTypeAnnotation, BaseExpression {
  type: 'Literal'
  value: string | boolean | number | null
  raw?: string | undefined
}

export interface RegExpLiteral extends BaseNodeWithTypeAnnotation, BaseExpression {
  type: 'Literal'
  value?: RegExp | null | undefined
  regex: {
    pattern: string
    flags: string
  }
  raw?: string | undefined
}

export interface BigIntLiteral extends BaseNodeWithTypeAnnotation, BaseExpression {
  type: 'Literal'
  value?: bigint | null | undefined
  bigint: string
  raw?: string | undefined
}

export type UnaryOperator = '-' | '+' | '!' | '~' | 'typeof' | 'void' | 'delete'

export type BinaryOperator =
  | '=='
  | '!='
  | '==='
  | '!=='
  | '<'
  | '<='
  | '>'
  | '>='
  | '<<'
  | '>>'
  | '>>>'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**'
  | '|'
  | '^'
  | '&'
  | 'in'
  | 'instanceof'

export type LogicalOperator = '||' | '&&' | '??'

export type AssignmentOperator =
  | '='
  | '+='
  | '-='
  | '*='
  | '/='
  | '%='
  | '**='
  | '<<='
  | '>>='
  | '>>>='
  | '|='
  | '^='
  | '&='

export type UpdateOperator = '++' | '--'

export interface ForOfStatement extends BaseForXStatement {
  type: 'ForOfStatement'
  await: boolean
}

export interface Super extends BaseNodeWithTypeAnnotation {
  type: 'Super'
}

export interface SpreadElement extends BaseNodeWithTypeAnnotation {
  type: 'SpreadElement'
  argument: Expression
}

export interface ArrowFunctionExpression extends BaseExpression, BaseFunction {
  type: 'ArrowFunctionExpression'
  expression: boolean
  body: BlockStatement | Expression
}

export interface YieldExpression extends BaseExpression {
  type: 'YieldExpression'
  argument?: Expression | null | undefined
  delegate: boolean
}

export interface TemplateLiteral extends BaseExpression {
  type: 'TemplateLiteral'
  quasis: Array<TemplateElement>
  expressions: Array<Expression>
}

export interface TaggedTemplateExpression extends BaseExpression {
  type: 'TaggedTemplateExpression'
  tag: Expression
  quasi: TemplateLiteral
}

export interface TemplateElement extends BaseNodeWithTypeAnnotation {
  type: 'TemplateElement'
  tail: boolean
  value: {
    /** It is null when the template literal is tagged and the text has an invalid escape (e.g. - tag`\unicode and \u{55}`) */
    cooked?: string | null | undefined
    raw: string
  }
}

export interface AssignmentProperty extends Property {
  value: Pattern
  kind: 'init'
  method: boolean // false
}

export interface ObjectPattern extends BasePattern {
  type: 'ObjectPattern'
  properties: Array<AssignmentProperty | RestElement>
}

export interface ArrayPattern extends BasePattern {
  type: 'ArrayPattern'
  elements: Array<Pattern | null>
}

export interface RestElement extends BasePattern {
  type: 'RestElement'
  argument: Pattern
}

export interface AssignmentPattern extends BasePattern {
  type: 'AssignmentPattern'
  left: Pattern
  right: Expression
}

export type Class = ClassDeclaration | ClassExpression
interface BaseClass extends BaseNodeWithTypeAnnotation {
  superClass?: Expression | null | undefined
  body: ClassBody
}

export interface ClassBody extends BaseNodeWithTypeAnnotation {
  type: 'ClassBody'
  body: Array<MethodDefinition | PropertyDefinition | StaticBlock>
}

export interface MethodDefinition extends BaseNodeWithTypeAnnotation {
  type: 'MethodDefinition'
  key: Expression | PrivateIdentifier
  value: FunctionExpression
  kind: 'constructor' | 'method' | 'get' | 'set'
  computed: boolean
  static: boolean
}

export interface ClassDeclaration extends BaseClass, BaseDeclaration {
  type: 'ClassDeclaration'
  /** It is null when a class declaration is a part of the `export default class` statement */
  id: Identifier | null
}

export interface ClassExpression extends BaseClass, BaseExpression {
  type: 'ClassExpression'
  id?: Identifier | null | undefined
}

export interface MetaProperty extends BaseExpression {
  type: 'MetaProperty'
  meta: Identifier
  property: Identifier
}

export type ModuleDeclaration =
  | ImportDeclaration
  | ExportNamedDeclaration
  | ExportDefaultDeclaration
  | ExportAllDeclaration
type BaseModuleDeclaration = BaseNodeWithTypeAnnotation

export type ModuleSpecifier =
  | ImportSpecifier
  | ImportDefaultSpecifier
  | ImportNamespaceSpecifier
  | ExportSpecifier
interface BaseModuleSpecifier extends BaseNodeWithTypeAnnotation {
  local: Identifier
}

export interface ImportDeclaration extends BaseModuleDeclaration {
  type: 'ImportDeclaration'
  specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>
  source: Literal
}

export interface ImportSpecifier extends BaseModuleSpecifier {
  type: 'ImportSpecifier'
  imported: Identifier
}

export interface ImportExpression extends BaseExpression {
  type: 'ImportExpression'
  source: Expression
}

export interface ImportDefaultSpecifier extends BaseModuleSpecifier {
  type: 'ImportDefaultSpecifier'
}

export interface ImportNamespaceSpecifier extends BaseModuleSpecifier {
  type: 'ImportNamespaceSpecifier'
}

export interface ExportNamedDeclaration extends BaseModuleDeclaration {
  type: 'ExportNamedDeclaration'
  declaration?: Declaration | null | undefined
  specifiers: Array<ExportSpecifier>
  source?: Literal | null | undefined
}

export interface ExportSpecifier extends BaseModuleSpecifier {
  type: 'ExportSpecifier'
  exported: Identifier
}

export interface ExportDefaultDeclaration extends BaseModuleDeclaration {
  type: 'ExportDefaultDeclaration'
  declaration: Declaration | Expression
}

export interface ExportAllDeclaration extends BaseModuleDeclaration {
  type: 'ExportAllDeclaration'
  exported: Identifier | null
  source: Literal
}

export interface AwaitExpression extends BaseExpression {
  type: 'AwaitExpression'
  argument: Expression
}

// Code below is added in order to support TS Nodes

export enum TSTypeAnnotationType {
  TSAnnotationType = 'TSAnnotationType',
  TSFunctionType = 'TSFunctionType',
  TSUnionType = 'TSUnionType',
  TSIntersectionType = 'TSIntersectionType',
  TSLiteralType = 'TSLiteralType'
}

export enum TSTypeKeyword {
  TSAnyKeyword = 'TSAnyKeyword',
  TSBigIntKeyword = 'TSBigIntKeyword',
  TSBooleanKeyword = 'TSBooleanKeyword',
  TSNeverKeyword = 'TSNeverKeyword',
  TSNullKeyword = 'TSNullKeyword',
  TSNumberKeyword = 'TSNumberKeyword',
  TSObjectKeyword = 'TSObjectKeyword',
  TSStringKeyword = 'TSStringKeyword',
  TSSymbolKeyword = 'TSSymbolKeyword',
  TSUndefinedKeyword = 'TSUndefinedKeyword',
  TSUnknownKeyword = 'TSUnknownKeyword',
  TSVoidKeyword = 'TSVoidKeyword'
}

export enum TSOnlyNode {
  TSTypeAliasDeclaration = 'TSTypeAliasDeclaration',
  TSAsExpression = 'TSAsExpression',
  TSInterfaceDeclaration = 'TSInterfaceDeclaration',
  TSTypeReference = 'TSTypeReference'
}

export const TSNodeType = {
  ...TSTypeAnnotationType,
  ...TSTypeKeyword,
  ...TSOnlyNode
}

// All node types in a ESTree AST with TS support
export type TSNodeType = TSTypeAnnotationType | TSTypeKeyword | TSOnlyNode

export type TSNode =
  | AnnotationTypeNode
  | FunctionTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | TypeAliasDeclarationNode
  | InterfaceDeclarationNode
  | AsExpressionNode
  | TypeReferenceNode

export type TypeNode =
  | TypeKeywordNode
  | FunctionTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | TypeReferenceNode
  | LiteralTypeNode

export interface TypeKeywordNode extends BaseNodeWithTypeAnnotation {
  type: TSTypeKeyword
}

export interface AnnotationTypeNode extends BaseNode {
  type: TSTypeAnnotationType.TSAnnotationType
  typeAnnotation: TypeNode
}

export interface FunctionTypeNode extends BaseNodeWithTypeAnnotation {
  type: TSTypeAnnotationType.TSFunctionType
  parameters: Identifier[]
  typeAnnotation: AnnotationTypeNode
}

export interface UnionTypeNode extends BaseNodeWithTypeAnnotation {
  type: TSTypeAnnotationType.TSUnionType
  types: TypeNode[]
}

export interface IntersectionTypeNode extends BaseNodeWithTypeAnnotation {
  type: TSTypeAnnotationType.TSIntersectionType
  // Remaining attributes are omitted from type as this node is disallowed
}

export interface LiteralTypeNode extends BaseNodeWithTypeAnnotation {
  type: TSTypeAnnotationType.TSLiteralType
  literal: Literal
}

export interface TypeAliasDeclarationNode extends BaseNode {
  type: TSOnlyNode.TSTypeAliasDeclaration
  id: Identifier
  typeAnnotation: TypeNode
}

export interface InterfaceDeclarationNode extends BaseNodeWithTypeAnnotation {
  type: TSOnlyNode.TSInterfaceDeclaration
  // Remaining attributes are omitted from type as this node is disallowed
}

export interface AsExpressionNode extends BaseNode {
  type: TSOnlyNode.TSAsExpression
  expression: Node
  typeAnnotation: TypeNode
}

export interface TypeReferenceNode extends BaseNodeWithTypeAnnotation {
  type: TSOnlyNode.TSTypeReference
  typeName: Identifier
}
