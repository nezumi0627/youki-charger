/**
 * Dump parsing, diagnosis and repair planning, ported from
 * MedalNfc.swift (MedalCapture) and MedalDiagnosis.swift.
 * Pure data processing only — NFC I/O is delegated to NFC Tools.
 */
import { badChecksumBlocks, blockChecksumIsValid, crypt, verifyChecksums, withChecksums } from "./crypto";
import { displayName, nameFor } from "./catalog";
import { bytesEqual } from "./bytes";

export const RAW_LENGTH = 180;
export const SIGNATURE = new Uint8Array([0xf5, 0x10, 0x12, 0x00, 0x42, 0x41, 0x42, 0x4f, 0, 1, 0, 1]);

export type IntegrityMode = "strict" | "recordDamage" | "diagnostic";

export interface MedalCapture {
  uid: Uint8Array;
  raw: Uint8Array;
  plaintext: Uint8Array;
  badChecksumBlocks: number[];
}

export function captureCiphertext(capture: MedalCapture): Uint8Array {
  return capture.raw.slice(24, 72);
}

export function hasValidChecksums(capture: MedalCapture): boolean {
  return capture.badChecksumBlocks.length === 0;
}

/** The UID stored in pages 0-1, skipping the BCC bytes at offsets 3 and 8. */
export function embeddedUID(raw: Uint8Array): Uint8Array {
  return new Uint8Array([raw[0], raw[1], raw[2], raw[4], raw[5], raw[6], raw[7]]);
}

export function uidFromDump(raw: Uint8Array): Uint8Array {
  if (raw.length !== RAW_LENGTH) throw new Error("ダンプは180バイト必要です");
  return embeddedUID(raw);
}

export function requireUID(uid: Uint8Array): void {
  if (uid.length !== 7 || uid[0] !== 4) throw new Error("NXP製の7バイトUIDが必要です");
}

export function validateIdentity(raw: Uint8Array, uid: Uint8Array): void {
  requireUID(uid);
  if (raw.length < 9) throw new Error("UIDページが不足しています");
  const bcc0 = 0x88 ^ uid[0] ^ uid[1] ^ uid[2];
  const bcc1 = uid[3] ^ uid[4] ^ uid[5] ^ uid[6];
  if (bcc0 !== raw[3] || bcc1 !== raw[8] || !bytesEqual(embeddedUID(raw), uid)) {
    throw new Error("検出UIDとページ内UID、BCCが一致しません");
  }
  if (raw.length < 24 || !bytesEqual(raw.slice(12, 24), SIGNATURE)) {
    throw new Error("メダルの公開ヘッダーが一致しません");
  }
}

export async function createCapture(raw: Uint8Array, uid: Uint8Array, mode: IntegrityMode = "strict"): Promise<MedalCapture> {
  if (raw.length !== RAW_LENGTH) throw new Error("ダンプは180バイト必要です");
  const normalizedRaw = new Uint8Array(raw);
  const normalizedUID = new Uint8Array(uid);
  validateIdentity(normalizedRaw, normalizedUID);
  const plain = await crypt(normalizedUID, normalizedRaw.slice(24, 72));
  const bad = badChecksumBlocks(plain);
  const allowed = bad.length === 0 || mode === "diagnostic" || (mode === "recordDamage" && !bad.includes(0));
  if (!allowed) throw new Error(`メダルのチェックサムが不正です。ブロック ${bad.join(",")}`);
  return { uid: normalizedUID, raw: normalizedRaw, plaintext: plain, badChecksumBlocks: bad };
}

// MARK: - Diagnosis (MedalDiagnosis.swift)

export interface DiagnosisSummary {
  title: string;
  message: string;
  aura: string;
  /** -1 means the captured records cannot provide a trustworthy count. */
  chargeCount: number;
}

export function canRepairSingleRecord(capture: MedalCapture | null): boolean {
  if (!capture || !blockChecksumIsValid(capture.plaintext, 0)) return false;
  return blockChecksumIsValid(capture.plaintext, 16) !== blockChecksumIsValid(capture.plaintext, 32);
}

export function canResetDamagedRecords(capture: MedalCapture | null): boolean {
  if (!capture || !blockChecksumIsValid(capture.plaintext, 0)) return false;
  return !blockChecksumIsValid(capture.plaintext, 16) && !blockChecksumIsValid(capture.plaintext, 32);
}

export function summarize(capture: MedalCapture | null): DiagnosisSummary {
  if (!capture) {
    return { title: "読み取れませんでした", message: "メダルを離して、もう一度かざしてください。", aura: "", chargeCount: -1 };
  }
  const bytes = capture.plaintext;
  if (bytes.length !== 48 || !blockChecksumIsValid(bytes, 0)) {
    return { title: "修復できません", message: "メダルの基本情報を確認できませんでした。", aura: "", chargeCount: -1 };
  }
  const primary = blockChecksumIsValid(bytes, 16);
  const secondary = blockChecksumIsValid(bytes, 32);
  if (!primary && !secondary) {
    return { title: "記録を作り直せます", message: "妖気なしの状態で作り直せます。妖気・回数・履歴は消去されます。", aura: "", chargeCount: -1 };
  }
  const offset = primary ? 16 : 32;
  const id = (bytes[offset + 12] << 8) | bytes[offset + 13];
  const aura = id === 0 ? "妖気なし" : displayName(nameFor(id));
  const count = bytes[offset + 14];
  if (primary !== secondary) {
    return { title: "修復を試せます", message: "残っている妖気を使って、壊れた記録を修復します。", aura, chargeCount: count };
  }
  if (!bytesEqual(bytes.slice(16, 32), bytes.slice(32, 48))) {
    return { title: "記録に違いがあります", message: "妖気を選んでチャージするか、バックアップから戻せます。", aura, chargeCount: count };
  }
  return { title: "読み取りできました", message: "記録のチェックに問題は見つかりませんでした。", aura, chargeCount: count };
}

// MARK: - Repair / rebuild plaintext transforms (MedalNfc.swift)

function requireSingleGoodRecord(capture: MedalCapture): number {
  const bad = capture.badChecksumBlocks;
  if (!(bad.length === 1 && (bad[0] === 1 || bad[0] === 2))) {
    throw new Error("メダル情報が正常で、片方の妖気レコードだけチェックサムが一致する場合に修復できます。");
  }
  return bad[0];
}

/** Copies the surviving record over the damaged one; nothing is inferred. */
export function repairPlaintext(capture: MedalCapture): Uint8Array {
  const damaged = requireSingleGoodRecord(capture);
  const survivor = damaged === 1 ? 2 : 1;
  const repaired = new Uint8Array(capture.plaintext);
  repaired.set(capture.plaintext.slice(survivor * 16, survivor * 16 + 16), damaged * 16);
  if (!verifyChecksums(repaired)) throw new Error("修復後のチェックサムを確認できません。");
  return repaired;
}

/** Zeroes both records (aura/history/count), preserving valid metadata. */
export function rebuildPlaintext(capture: MedalCapture): Uint8Array {
  const bad = capture.badChecksumBlocks;
  if (!(bad.length === 2 && bad[0] === 1 && bad[1] === 2)) {
    throw new Error("メダル情報が正常で、両方の妖気レコードのチェックサムが不一致の場合に初期化できます。");
  }
  const reset = new Uint8Array(capture.plaintext);
  reset.fill(0, 16, 48);
  const result = withChecksums(reset);
  if (!verifyChecksums(result)) throw new Error("初期化後のチェックサムを確認できません。");
  return result;
}

/** True when the page is not write-locked in this raw dump. */
export function isWritable(raw: Uint8Array, page: number): boolean {
  if (page <= 7) return (raw[10] & (1 << page)) === 0;
  if (page <= 15) return (raw[11] & (1 << (page - 8))) === 0;
  return (raw[160] & 1) === 0;
}
