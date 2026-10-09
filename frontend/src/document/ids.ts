const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function createId(prefix = "id"): string {
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `${prefix}_${cryptoObj.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${out}`;
}

export function fieldKeyFromLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base.length > 0 ? base : "field";
}
