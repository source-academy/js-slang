import { Parser } from 'acorn'

const typeParser = (BaseParser: typeof Parser) => {
  return class extends BaseParser {}
}

export default typeParser
