import { Position, SourceLocation } from 'acorn'

export const positionToSourceLocation = (position: Position): SourceLocation => ({
  start: position,
  end: { ...position, column: position.column + 1 }
})
