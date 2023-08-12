export const runeTypeDeclarations = {
  prelude: `type Rune = 'Rune';
  type AnimatedRune = 'AnimatedRune';`,
  blank: `const blank: Rune = 'Rune';`,
  circle: `const circle: Rune = 'Rune';`,
  corner: `const corner: Rune = 'Rune';`,
  heart: `const heart: Rune = 'Rune';`,
  nova: `const nova: Rune = 'Rune';`,
  pentagram: `const pentagram: Rune = 'Rune';`,
  rcross: `const rcross: Rune = 'Rune';`,
  ribbon: `const ribbon: Rune = 'Rune';`,
  sail: `const sail: Rune = 'Rune';`,
  square: `const square: Rune = 'Rune';`,
  triangle: `const triangle: Rune = 'Rune';`,
  black: `function black(rune: Rune): Rune {
    return 'Rune';
  }`,
  blue: `function blue(rune: Rune): Rune {
    return 'Rune';
  }`,
  brown: `function brown(rune: Rune): Rune {
    return 'Rune';
  }`,
  color: `function color(rune: Rune, r: number, g: number, b: number): Rune {
    return 'Rune';
  }`,
  green: `function green(rune: Rune): Rune {
    return 'Rune';
  }`,
  indigo: `function indigo(rune: Rune): Rune {
    return 'Rune';
  }`,
  orange: `function orange(rune: Rune): Rune {
    return 'Rune';
  }`,
  pink: `function pink(rune: Rune): Rune {
    return 'Rune';
  }`,
  purple: `function purple(rune: Rune): Rune {
    return 'Rune';
  }`,
  random_color: `function random_color(rune: Rune): Rune {
    return 'Rune';
  }`,
  red: `function red(rune: Rune): Rune {
    return 'Rune';
  }`,
  white: `function white(rune: Rune): Rune {
    return 'Rune';
  }`,
  yellow: `function yellow(rune: Rune): Rune {
    return 'Rune';
  }`,
  anaglyph: `function anaglyph(rune: Rune): Rune {
    return 'Rune';
  }`,
  animate_anaglyph: `animate_anaglyph(duration: number, fps: number, func: RuneAnimation): AnimatedRune {
    return 'AnimatedRune';
  }`,
  animate_rune: `function animate_rune(duration: number, fps: number, func: RuneAnimation): AnimatedRune {
    return 'AnimatedRune';
  }`,
  beside: `function beside(rune1: Rune, rune2: Rune): Rune {
    return 'Rune';
  }`,
  beside_frac: `function beside_frac(frac: number, rune1: Rune, rune2: Rune): Rune {
    return 'Rune';
  }`,
  flip_horiz: `function flip_horiz(rune: Rune): Rune {
    return 'Rune';
  }`,
  flip_vert: `function flip_vert(rune: Rune): Rune {
    return 'Rune';
  }`,
  from_url: `function from_url(imageUrl: string): Rune {
    return 'Rune';
  }`,
  hollusion: `function hollusion(rune: Rune): Rune {
    return 'Rune';
  }`,
  hollusion_magnitude: `function hollusion_magnitude(rune: Rune, magnitude: number): Rune {
    return 'Rune';
  }`,
  make_cross: `function make_cross(rune: Rune): Rune {
    return 'Rune';
  }`,
  overlay: `function overlay(rune1: Rune, rune2: Rune): Rune {
    return 'Rune';
  }`,
  overlay_frac: `function overlay_frac(frac: number, rune1: Rune, rune2: Rune): Rune {
    return 'Rune';
  }`,
  quarter_turn_left: `function quarter_turn_left(rune: Rune): Rune {
    return 'Rune';
  }`,
  quarter_turn_right: `function quarter_turn_right(rune: Rune): Rune {
    return 'Rune';
  }`,
  repeat_pattern: `function repeat_pattern(n: number, pattern: ((a: Rune) => Rune), initial: Rune): Rune {
    return 'Rune';
  }`,
  rotate: `function rotate(rad: number, rune: Rune): Rune {
    return 'Rune';
  }`,
  scale: `function scale(ratio: number, rune: Rune): Rune {
    return 'Rune';
  }`,
  scale_independent: `function scale_independent(ratio_x: number, ratio_y: number, rune: Rune): Rune {
    return 'Rune';
  }`,
  show: `function show(rune: Rune): Rune {
    return 'Rune';
  }`,
  stack: `function stack(rune1: Rune, rune2: Rune): Rune {
    return 'Rune';
  }`,
  stack_frac: `function stack_frac(frac: number, rune1: Rune, rune2: Rune): Rune {
    return 'Rune';
  }`,
  stackn: `function stackn(n: number, rune: Rune): Rune {
    return 'Rune';
  }`,
  translate: `function translate(x: number, y: number, rune: Rune): Rune {
    return 'Rune';
  }`,
  turn_upside_down: `function turn_upside_down(rune: Rune): Rune {
    return 'Rune';
  }`
}
