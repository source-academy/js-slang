import * as astring from 'astring'
import { Node } from '../types'

function reindent(state: any, text: any, indent: any, lineEnd: any) {
  /*
    Writes into `state` the `text` string reindented with the provided `indent`.
    */
  const lines = text.split('\n')
  const end = lines.length - 1
  state.write(lines[0].trim())
  if (end > 0) {
    state.write(lineEnd)
    for (let i = 1; i < end; i++) {
      state.write(indent + lines[i].trim() + lineEnd)
    }
    state.write(indent + lines[end].trim())
  }
}

function formatComments(state: any, comments: any, indent: any, lineEnd: any) {
  /*
    Writes into `state` the provided list of `comments`, with the given `indent` and `lineEnd` strings.
    Line comments will end with `"\n"` regardless of the value of `lineEnd`.
    Expects to start on a new unindented line.
    */
  const { length } = comments
  for (let i = 0; i < length; i++) {
    const comment = comments[i]
    state.write(indent)
    if (comment.type[0] === 'L') {
      // Line comment
      state.write('// ' + comment.value.trim() + '\n', comment)
    } else {
      // Block comment
      state.write('/*')
      reindent(state, comment.value, indent, lineEnd)
      state.write('*/' + lineEnd)
    }
  }
}

const sourceGen = Object.assign({}, astring.GENERATOR, {
  StatementSequence: function (node: any, state: any) {
    const indent = state.indent.repeat(state.indentLevel++)
    const { lineEnd, writeComments } = state
    const statementIndent = indent + state.indent
    state.write('[')
    const statements = node.body
    if (statements != null && statements.length > 0) {
      state.write(lineEnd)
      if (writeComments && node.comments != null) {
        formatComments(state, node.comments, statementIndent, lineEnd)
      }
      const { length } = statements
      for (let i = 0; i < length; i++) {
        const statement = statements[i]
        if (writeComments && statement.comments != null) {
          formatComments(state, statement.comments, statementIndent, lineEnd)
        }
        state.write(statementIndent)
        this[statement.type](statement, state)
        state.write(lineEnd)
      }
      state.write(indent)
    } else {
      if (writeComments && node.comments != null) {
        state.write(lineEnd)
        formatComments(state, node.comments, statementIndent, lineEnd)
        state.write(indent)
      }
    }
    if (writeComments && node.trailingComments != null) {
      formatComments(state, node.trailingComments, statementIndent, lineEnd)
    }
    state.write(']')
    state.indentLevel--
  }
})

export const astToString = (node: Node): string =>
  astring.generate(node, {
    generator: sourceGen
  })
