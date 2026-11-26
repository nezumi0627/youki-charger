/** Byte helpers shared by the medal core. All data is Uint8Array. */

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) throw new Error("HEX文字列の長さが奇数です");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
}

/** Hex with a space between bytes, the style NFC Tools displays. */
export function bytesToSpacedHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Extracts bytes from free-form pasted text (e.g. NFC Tools output).
 * Accepts spaced/continuous hex and 0x-prefixed tokens; other text is ignored.
 */
export function extractHexBytes(text: string): Uint8Array {
  const tokens = text.match(/0x[0-9a-fA-F]+|[0-9a-fA-F]+/g) ?? [];
  const chunks: string[] = [];
  for (const token of tokens) {
    const t = token.replace(/^0x/i, "");
    if (t.length % 2 === 0 && t.length >= 2) chunks.push(t);
    else if (t.length > 2) chunks.push(t.slice(0, t.length - (t.length % 2)));
  }
  try {
    return hexToBytes(chunks.join(""));
  } catch {
    return new Uint8Array(0);
  }
}
