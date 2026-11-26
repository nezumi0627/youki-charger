/**
 * Record operations, ported from YoukiRecord.swift.
 * The 48-byte plaintext is metadata (16) + two identical charge records (16 each).
 * Each record: 12-byte history bitmap, big-endian 16-bit ID, saturating counter, checksum.
 */
import { DATA_LENGTH, checksumByte, verifyChecksums } from "./crypto";

export const RECORD_LENGTH = 16;
export const RECORD_OFFSET = 16;
export const HISTORY_LENGTH = 12;
export const MAX_HISTORY_ENTRY = HISTORY_LENGTH * 8;
export const MAX_ENTRY_NUMBER = 97;

const ID_OFFSET = 12;
const COUNT_OFFSET = 14;
const CHECKSUM_OFFSET = 15;

function requireValidPlain(plain: Uint8Array): void {
  if (plain.length !== DATA_LENGTH) {
    throw new Error(`平文は${DATA_LENGTH}バイト必要です（入力: ${plain.length}バイト）`);
  }
  if (!verifyChecksums(plain)) throw new Error("保護データのチェックサムが一致しません。");
}

function refreshChecksum(bytes: Uint8Array, offset: number): void {
  bytes[offset + CHECKSUM_OFFSET] = checksumByte(bytes, offset);
}

/**
 * Uses the primary record and duplicates the edited record into both slots.
 * ID 0 clears only the ID, preserving history and the counter.
 * Entries 0 and 97 add no history bit, matching the game's bounds check.
 */
export function applyYouki(plain: Uint8Array, id: number, entryNumber: number): Uint8Array {
  requireValidPlain(plain);
  if (!Number.isInteger(id) || id < 0 || id > 0xffff) throw new Error("妖気IDは0〜65535の範囲で指定してください。");
  if (!Number.isInteger(entryNumber) || entryNumber < 0 || entryNumber > MAX_ENTRY_NUMBER) {
    throw new Error("履歴番号は0〜97の範囲で指定してください。");
  }
  const result = new Uint8Array(plain);
  const record = result.slice(RECORD_OFFSET, RECORD_OFFSET + RECORD_LENGTH);
  record[ID_OFFSET] = (id >> 8) & 0xff;
  record[ID_OFFSET + 1] = id & 0xff;
  if (id !== 0) {
    record[COUNT_OFFSET] = Math.min(255, record[COUNT_OFFSET] + 1);
    if (entryNumber > 0 && entryNumber <= MAX_HISTORY_ENTRY) {
      const index = entryNumber - 1;
      record[Math.floor(index / 8)] |= 1 << (7 - (index % 8));
    }
  }
  refreshChecksum(record, 0);
  result.set(record, RECORD_OFFSET);
  result.set(record, RECORD_OFFSET + RECORD_LENGTH);
  return result;
}

/** Resets each record's counter independently, preserving its ID/history. */
export function resetChargeCount(plain: Uint8Array): Uint8Array {
  requireValidPlain(plain);
  const result = new Uint8Array(plain);
  for (let slot = 0; slot < 2; slot++) {
    const offset = RECORD_OFFSET + slot * RECORD_LENGTH;
    result[offset + COUNT_OFFSET] = 0;
    refreshChecksum(result, offset);
  }
  return result;
}

export function currentId(plain: Uint8Array): number {
  requireValidPlain(plain);
  return (plain[RECORD_OFFSET + ID_OFFSET] << 8) | plain[RECORD_OFFSET + ID_OFFSET + 1];
}

export function chargeCount(plain: Uint8Array): number {
  requireValidPlain(plain);
  return plain[RECORD_OFFSET + COUNT_OFFSET];
}
