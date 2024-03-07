import { Parser } from '../types'

export class GoParser implements Parser<any> {
  parse(programStr: string, context: any, options?: any, throwOnError?: boolean): any {
    throw new Error('Method not implemented.')
  }
  validate(ast: any, context: any, throwOnError?: boolean): boolean {
    throw new Error('Method not implemented.')
  }
}
