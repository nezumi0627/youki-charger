/**
 * Medal cryptography, ported from MedalCrypto.swift (Android core port).
 * Key derivation: HMAC-SHA256 x2 with a nibble S-box between them.
 * Cipher: AES-128-CTR, big-endian counter, no padding (CTR is symmetric).
 * WebCrypto supplies both; in the browser this needs a secure context
 * (https or localhost), which GitHub Pages satisfies.
 */

export const UID_LENGTH = 7;
export const DATA_LENGTH = 48;
export const BLOCK_LENGTH = 16;

const KEY1 = new TextEncoder().encode("SjqjE90z8w");
const KEY2 = new TextEncoder().encode("bYYw75Ks9K");
const SBOX = [14, 2, 11, 7, 5, 0, 12, 8, 10, 13, 15, 4, 6, 3, 1, 9];

export interface MedalKeys {
  password: Uint8Array;
  key: Uint8Array;
  iv: Uint8Array;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource));
}

export async function deriveKeys(uid: Uint8Array): Promise<MedalKeys> {
  if (uid.length !== UID_LENGTH) {
    throw new Error(`UIDは${UID_LENGTH}バイト必要です（入力: ${uid.length}バイト）`);
  }
  const h1 = await hmacSha256(KEY1, uid);
  for (let i = 0; i < h1.length; i++) {
    const byte = h1[i];
    h1[i] = (SBOX[byte >> 4] << 4) | SBOX[byte & 15];
  }
  const h2 = await hmacSha256(KEY2, h1);
  const iv = new Uint8Array([...h2.slice(24, 32), ...uid, 0]);
  for (let i = 0; i < 15; i++) iv[i] ^= h2[i];
  return { password: h2.slice(28, 32), key: h2.slice(0, 16), iv };
}

/** Encrypts or decrypts the 48-byte protected payload (CTR is symmetric). */
export async function crypt(uid: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  if (data.length !== DATA_LENGTH) {
    throw new Error(`保護データは${DATA_LENGTH}バイト必要です（入力: ${data.length}バイト）`);
  }
  const keys = await deriveKeys(uid);
  const cryptoKey = await crypto.subtle.importKey("raw", keys.key as BufferSource, { name: "AES-CTR" }, false, ["encrypt"]);
  const result = await crypto.subtle.encrypt(
    { name: "AES-CTR", counter: keys.iv as BufferSource, length: 128 },
    cryptoKey,
    data as BufferSource,
  );
  return new Uint8Array(result);
}

export async function decryptAndVerify(uid: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
  const plain = await crypt(uid, ciphertext);
  if (!verifyChecksums(plain)) throw new Error("保護データのチェックサムが一致しません。");
  return plain;
}

// MARK: - Checksums (the one implementation, same as the Swift core)

export function checksumByte(bytes: Uint8Array, offset: number): number {
  let sum = 0;
  for (let i = offset; i < offset + BLOCK_LENGTH - 1; i++) sum += bytes[i];
  return sum & 0xff;
}

export function blockChecksumIsValid(bytes: Uint8Array, offset: number): boolean {
  if (offset < 0 || bytes.length < offset + BLOCK_LENGTH) return false;
  return checksumByte(bytes, offset) === bytes[offset + BLOCK_LENGTH - 1];
}

export function badChecksumBlocks(plain: Uint8Array): number[] {
  const bad: number[] = [];
  for (let block = 0; block < DATA_LENGTH / BLOCK_LENGTH; block++) {
    if (!blockChecksumIsValid(plain, block * BLOCK_LENGTH)) bad.push(block);
  }
  return bad;
}

export function verifyChecksums(plain: Uint8Array): boolean {
  return plain.length === DATA_LENGTH && badChecksumBlocks(plain).length === 0;
}

export function withChecksums(plain: Uint8Array): Uint8Array {
  if (plain.length !== DATA_LENGTH) {
    throw new Error(`平文は${DATA_LENGTH}バイト必要です（入力: ${plain.length}バイト）`);
  }
  const out = new Uint8Array(plain);
  for (let offset = 0; offset < DATA_LENGTH; offset += BLOCK_LENGTH) {
    out[offset + BLOCK_LENGTH - 1] = checksumByte(out, offset);
  }
  return out;
}
