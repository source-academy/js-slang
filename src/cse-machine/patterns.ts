// a single pattern stored within the patterns component
// will be henceforth referred to as a "transformer".
// it consists of a set of literals used as additional syntax, 
// a pattern (for a list to match against)
// and a final template (for the list to be transformed into).
import { List, Pair } from "../stdlib/list";
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { flattenList, isList } from "./scheme-macros";

export class Transformer {
    literals: string[]
    pattern: List
    template: List

    constructor(literals: string[], pattern: List, template: List) {
        this.literals = literals
        this.pattern = pattern
        this.template = template
    }
}

function isImproperList(value: any): boolean {
    if (value === null) {
        return false
    }
    return Array.isArray(value) && value.length === 2 && !isList(value[1])
}

// we use the match() function to match a list against a pattern and literals
// and verify if it is a match.
function match(input: any, pattern: List | Pair<any, any> | _Symbol, literals: string[]): boolean {
    if (pattern instanceof _Symbol && !literals.includes(pattern.sym)) {
        // this will match whatever the input list is unless it is 
        // a literal in the literals list. (ie syntax)
        return !(input instanceof _Symbol && !literals.includes(input.sym))
    }

    if (pattern instanceof _Symbol && literals.includes(pattern.sym)) {
        // only match if the input is the same as the pattern
        return input instanceof _Symbol && input.sym === pattern.sym
    }

    // at this point, we know that the pattern is a list or improper list
    // make sure that the input is one too.
    if (!isList(input) || !isImproperList(input)) {
        return false
    }

    // make sure that both the pattern and input match each other.
    // they should both be lists or improper lists, with no mix.
    if (isImproperList(pattern) !== isImproperList(input)) {
        return false
    }

    // in the case that both the pattern and input are improper lists,
    if (isImproperList(pattern) && isImproperList(input)) {
        // match the first element of the list with the first element of the pattern
        return match(input[0], (pattern as Pair<any, any>)[0], literals) && match(input[1], pattern as Pair<any, any>[1], literals)
    }

    // now we know that both the pattern and list are lists.
    // we can match the elements of the list against the pattern,
    // but we also need to compare and check for the ... syntax.
    if (input == pattern == null) {
        return true
    }

    // it's easier to reason about the lists as arrays for now.
    const inputList = flattenList(input)
    const patternList = flattenList(pattern)


    // there can be a single ellepsis in the pattern, but it must be behind some element.
    // scan the pattern for the ... symbol.
    // we will need the position of the ... symbol to compare the front and back of the list.
    const ellipsisIndex = patternList.findIndex((elem) => elem instanceof _Symbol && elem.sym === '...')

    // check if an ellipsis exists within the pattern.
    if (ellipsisIndex !== -1) {
        // if the input is shorter than the pattern (minus the ...), it can't match.
        if (inputList.length < patternList.length - 1) {
            return false
        }

        const frontPatternLength = ellipsisIndex
        const ellipsisPattern = patternList[ellipsisIndex - 1]
        const backPatternLength = patternList.length - ellipsisIndex - 1

        // compare the front of the list with the front of the pattern as per normal
        for (let i = 0; i < frontPatternLength; i++) {
            if (!match(inputList[i], patternList[i], literals)) {
                return false
            }
        }

        // compare the items that should be captured by the ellipsis
        for (let i = ellipsisIndex; i < inputList.length - backPatternLength; i++) {
            if (!match(inputList[i], ellipsisPattern, literals)) {
                return false
            }
        }

        // now we can compare the back of the list with the rest of the patterns
        for (let i = inputList.length - backPatternLength; i < inputList.length; i++) {
            if (!match(inputList[i], patternList[i - (inputList.length - patternList.length)], literals)) {
                return false
            }
        }

        // else all is good and return true
        return true
    }
    
    // we assume for now that ... cannot appear elsewhere in this level of the pattern, except at the end.
    // so here, we have no ... syntax.

    // we can just compare the elements of the list with the pattern.
    if (inputList.length !== patternList.length) {
        return false
    }

    for (let i = 0; i < inputList.length; i++) {
        if (!match(inputList[i], patternList[i], literals)) {
            return false
        }
    }

    return true
}

// once a pattern is matched, we need to collect all of the matched variables.
// ONLY called on matching patterns.
function collect(input: any, pattern: List | Pair<any, any> | _Symbol, literals: string[]): Map<string, any[]> {
    const collected = new Map<string, (List | _Symbol)[]>()
    if (pattern instanceof _Symbol && !literals.includes(pattern.sym)) {
        // collect the matching input here
        collected.set(pattern.sym, [input])
        return collected
    }
    
    if (pattern instanceof _Symbol && literals.includes(pattern.sym)) {
        // pattern is a syntax literal, don't collect anything
        return collected
    }

    if (pattern instanceof _Symbol && pattern.sym === '_') {
        // don't collect anything
        return collected
    }

    // if one is an improper list, the other should be as well.
    if (isImproperList(pattern)) {
        // collect the first element of the list
        const collectedFirst = collect(input[0], (pattern as Pair<any, any>)[0], literals)
        for (const [key, value] of collectedFirst) {
            collected.set(key, value)
        }

        // collect the second element of the list
        const collectedSecond = collect(input[1], (pattern as Pair<any, any>)[1], literals)
        for (const [key, value] of collectedSecond) {
            collected.set(key, value)
        }

        return collected
    }

    // at this point, we know that the pattern is a list
    // and the input should be too
    if (!isList(input)) {
        return collected
    }

    if (input == pattern == null) {
        // should be empty
        return collected
    }

    const inputList = flattenList(input)
    const patternList = flattenList(pattern)
    // there can be a single ellepsis in the pattern, but it must be behind some element.
    // scan the pattern for the ... symbol.
    // we will need the position of the ... symbol to compare the front and back of the list.
    const ellipsisIndex = patternList.findIndex((elem) => elem instanceof _Symbol && elem.sym === '...')

    // check if an ellipsis exists within the pattern.
    if (ellipsisIndex !== -1) {
        const frontPatternLength = ellipsisIndex
        const ellipsisPattern = patternList[ellipsisIndex - 1]
        const backPatternLength = patternList.length - ellipsisIndex - 1

        // collect items from the front of the list with the front of the pattern
        for (let i = 0; i < frontPatternLength; i++) {
            const collectedFront = collect(inputList[i], patternList[i], literals)
            for (const [key, value] of collectedFront) {
                if (collected.has(key)) {
                    // add the collected items to the back of the list
                    // (this preserves the order of the list)
                    collected.set(key, [...collected.get(key) as any[], ...value])
                } else {
                    collected.set(key, value)
                }
            }
        }


        // compare the items that should be captured by the ellipsis
        for (let i = ellipsisIndex; i < inputList.length - backPatternLength; i++) {
            const collectedEllipsis = collect(inputList[i], ellipsisPattern, literals)
            for (const [key, value] of collectedEllipsis) {
                if (collected.has(key)) {
                    collected.set(key, [...collected.get(key) as any[], ...value])
                } else {
                    collected.set(key, value)
                }
            }
        }

        // collect the rest of the list with the back of the pattern
        for (let i = inputList.length - backPatternLength; i < inputList.length; i++) {
            const collectedRest = collect(inputList[i], patternList[i - (inputList.length - patternList.length)], literals)
            for (const [key, value] of collectedRest) {
                if (collected.has(key)) {
                    collected.set(key, [...collected.get(key) as any[], ...value])
                } else {
                    collected.set(key, value)
                }
            }
        }

        return collected
    }

    // final case, where there is no ... syntax
    for (let i = 0; i < inputList.length; i++) {
        const collectedItems = collect(inputList[i], patternList[i], literals)
        for (const [key, value] of collectedItems) {
            if (collected.has(key)) {
                collected.set(key, [...collected.get(key) as any[], ...value])
            } else {
                collected.set(key, value)
            }
        }
    }

    return collected
}

// when matched against a pattern, we use the transform() function
// to transform the list into the template.
// returns a list, a pair, or any value, as determined by the template.
function transform(template: List | Pair<any, any> | _Symbol, collected: Map<string, any[]>): any {
    function arrayToList(arr: any[]): List {
        if (arr.length === 0) {
            return null
        }
        return [arr[0], arrayToList(arr.slice(1))]
    }

    if (template instanceof _Symbol) {
        if (collected.has(template.sym)) {
            // get the item from the collected list,
            // remove it from the collected list,
            // and return it.
            const item = (collected.get(template.sym) as any[]).shift()
            return item
        }
        return template
    }

    if (isImproperList(template)) {
        // assemble both parts of the template separately
        const firstPart = transform((template as Pair<any, any>)[0], collected)
        const secondPart = transform((template as Pair<any, any>)[1], collected)
        return [firstPart, secondPart]
    }

    // at this point, its a list.
    const templateList = flattenList(template)

    // if the template is empty, return null
    if (templateList.length === 0) {
        return null
    }

    // if the template begins with the ... syntax, (... <value>)
    // it halts evaluation of the rest of the list.
    // (evaluation resolves to <value>)
    if (templateList[0] instanceof _Symbol && templateList[0].sym === '...') {
        return templateList[1]
    }

    // we need to deal with any ... syntax as well.
    // there is only one at the 1D flattened list level, and we need to deal with it.
    const ellipsisIndex = templateList.findIndex((elem) => elem instanceof _Symbol && elem.sym === '...')
    
    if (ellipsisIndex !== -1) {
        const frontTemplateLength = ellipsisIndex
        const ellipsisTemplate = templateList[ellipsisIndex + 1]
        const backTemplateLength = templateList.length - ellipsisIndex - 1

        const transformedList = []

        // transform the front of the list
        for (let i = 0; i < frontTemplateLength; i++) {
            transformedList.push(transform(templateList[i], collected))
        }
        
        // add the values from the ellipsis template
        // TODO 
    }

    // if there is no ... syntax, we can just evaluate the list as is.
    // use iteration, as we are not sure that map evaluates left to right.
    const transformedList = []
    
    for (let i = 0; i < templateList.length; i++) {
        transformedList.push(transform(templateList[i], collected))
    }

    return arrayToList(transformedList)
}