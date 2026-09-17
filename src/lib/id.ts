const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function newId(prefix: string): string {
  let random = "";
  for (let index = 0; index < 6; index += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${Date.now().toString(36)}${random}`;
}