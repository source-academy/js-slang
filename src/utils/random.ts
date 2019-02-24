const RANDOM_CHARACTERS = [...'1234567890$_']
export const integer = () => Math.floor(Math.random() * 10000)
export const character = () => RANDOM_CHARACTERS[integer() % RANDOM_CHARACTERS.length]
