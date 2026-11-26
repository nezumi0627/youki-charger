/**
 * NFC command sequences for NFC Tools (Advanced NFC Commands).
 * The web app never talks to the tag itself: it generates command lists
 * for the user to run in NFC Tools, and parses the responses they paste back.
 *
 * Canonical NFC Tools format (wakdev guide + field reports, see
 * docs/nfc-tools-spec.md): each byte as 2 hex digits joined with ":",
 * multiple commands joined with "," in one Data field, executed in order
 * within a single tap session. Command bytes exclude RF framing/CRC.
 *
 * PWD_AUTH only holds for the current session, so every sequence that
 * touches protected pages starts with its own PWD_AUTH command.
 * FAST READ (0x3A) is not used: no NFC Tools example for it was found,
 * and READ (0x30) covers the same pages in 16-byte steps.
 */
import { crypt, deriveKeys } from "./crypto";
import { RAW_LENGTH, captureCiphertext, isWritable, type MedalCapture } from "./dump";
import { bytesEqual, bytesToHex } from "./bytes";

/** Pages read with READ (0x30, 16 bytes each) to assemble the 180-byte raw dump. */
export const READ_PAGES = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 41];
/** Write order used by the Swift core: record pages first, metadata pages last. */
export const WRITE_ORDER = [14, 15, 16, 17, 10, 11, 12, 13, 6, 7, 8, 9];

const cmd = (bytes: number[]): string => bytesToHex(new Uint8Array(bytes));
const pageHex = (page: number): string => page.toString(16).padStart(2, "0").toUpperCase();
const readCommands = (): string[] => READ_PAGES.map((page) => cmd([0x30, page]));

export async function authCommand(uid: Uint8Array): Promise<string> {
  const keys = await deriveKeys(uid);
  return "1B" + bytesToHex(keys.password);
}

/**
 * Full read sequence: version check, public header, one PWD_AUTH, then all pages.
 * Authentication is attempted exactly once, as in the Swift core.
 * Responses total 218 bytes (8 version + 16 header + 2 PACK + 12x16 reads).
 */
export async function buildReadCommands(uid: Uint8Array): Promise<string[]> {
  return [
    cmd([0x60]), // GET_VERSION
    cmd([0x30, 0x00]), // READ page 0 (public header)
    await authCommand(uid), // PWD_AUTH
    ...readCommands(),
  ];
}

function assembleFromReads(responses: Uint8Array[]): Uint8Array {
  const raw = new Uint8Array(RAW_LENGTH);
  READ_PAGES.forEach((page, i) => {
    raw.set(responses[i].slice(0, 16), page * 4);
  });
  return raw;
}

function sliceReads(bytes: Uint8Array, offset: number): Uint8Array {
  const reads: Uint8Array[] = [];
  for (let i = 0; i < READ_PAGES.length; i++) {
    reads.push(bytes.slice(offset + i * 16, offset + (i + 1) * 16));
  }
  return assembleFromReads(reads);
}

/**
 * Parses bytes extracted from pasted NFC Tools output into the 180-byte raw dump.
 * Accepts: the full read sequence's responses (218 bytes), a verify sequence's
 * responses (2 PACK + 192 = 194 bytes), just the 12 read responses (192 bytes),
 * or a raw dump (180 bytes, e.g. from NFC Tools' memory-dump export).
 */
export function parseReadResponses(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 218) {
    if (!(bytes[0] === 0 && bytes[1] === 4 && bytes[2] === 4 && bytes[6] === 0x0f && bytes[7] === 3)) {
      throw new Error("GET_VERSIONがNTAG213と一致しません");
    }
    if (!(bytes[24] === 0xbe && bytes[25] === 0xef)) {
      throw new Error("PWD_AUTHの応答（PACK）が BEEF ではありません。認証に失敗した可能性があります。");
    }
    return sliceReads(bytes, 26);
  }
  if (bytes.length === 194) {
    if (!(bytes[0] === 0xbe && bytes[1] === 0xef)) {
      throw new Error("PWD_AUTHの応答（PACK）が BEEF ではありません。認証に失敗した可能性があります。");
    }
    return sliceReads(bytes, 2);
  }
  if (bytes.length === 192) return sliceReads(bytes, 0);
  if (bytes.length === RAW_LENGTH) return new Uint8Array(bytes);
  throw new Error(
    `応答のバイト数が想定と違います（${bytes.length}バイト）。読込コマンド全体の応答を貼るか、NFC Toolsのダンプ書き出し（.bin）を取り込んでください。`,
  );
}

export interface WritePlan {
  /** PWD_AUTH + WRITE commands, run in one tap. */
  commands: string[];
  /** Separate PWD_AUTH + full read-back sequence, run in a second tap for verification. */
  verifyCommands: string[];
  /** Pages that will change, in write order. */
  changedPages: number[];
  targetCiphertext: Uint8Array;
}

/**
 * Builds the write plan for a transformed plaintext: one PWD_AUTH and one
 * WRITE per changed page (Swift write order, lock-checked). Verification is
 * a separate sequence because the tag session (and its auth) ends per tap.
 */
export async function buildWritePlan(capture: MedalCapture, targetPlaintext: Uint8Array): Promise<WritePlan> {
  const targetCiphertext = await crypt(capture.uid, targetPlaintext);
  const current = captureCiphertext(capture);
  const changedPages = WRITE_ORDER.filter((page) => {
    const offset = (page - 6) * 4;
    return !bytesEqual(current.slice(offset, offset + 4), targetCiphertext.slice(offset, offset + 4));
  });
  for (const page of changedPages) {
    if (!isWritable(capture.raw, page)) throw new Error(`ページ${page}は書込みロックされています`);
  }
  const auth = await authCommand(capture.uid);
  const commands = [auth];
  for (const page of changedPages) {
    const offset = (page - 6) * 4;
    commands.push("A2" + pageHex(page) + bytesToHex(targetCiphertext.slice(offset, offset + 4)));
  }
  return { commands, verifyCommands: [auth, ...readCommands()], changedPages, targetCiphertext };
}

/**
 * Harmless field-test plan: authenticate, write one page back with its
 * current bytes (no data change), and read it back. Proves that auth state
 * survives across commands and that WRITE works, without altering the medal.
 */
export async function buildNoOpTestPlan(capture: MedalCapture): Promise<string[]> {
  const page = 6;
  const current = captureCiphertext(capture).slice(0, 4);
  return [
    await authCommand(capture.uid),
    "A2" + pageHex(page) + bytesToHex(current),
    cmd([0x30, page]),
  ];
}

export type CommandFormat = "tools" | "colonLines" | "plain";

/**
 * Copy formats. "tools" is the canonical NFC Tools Data-field format:
 * colon-separated bytes, comma-separated commands.
 */
export function formatCommands(commands: string[], format: CommandFormat): string {
  const colonize = (command: string) => command.replace(/(..)/g, "$1:").replace(/:$/, "");
  switch (format) {
    case "tools":
      return commands.map(colonize).join(",");
    case "colonLines":
      return commands.map(colonize).join("\n");
    case "plain":
      return commands.join("\n");
  }
}
