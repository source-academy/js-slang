export type Pos = number;
    
export function isValid(pos: Pos) : boolean {
    return pos != NoPos;
}

export const NoPos : Pos = 0;

export function calcPos(offset : number) : Pos {
    return offset;
}
