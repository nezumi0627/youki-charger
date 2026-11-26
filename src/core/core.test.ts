import { describe, expect, test } from "bun:test";
import { crypt, decryptAndVerify, deriveKeys, verifyChecksums, withChecksums } from "./crypto";
import { applyYouki, chargeCount, currentId, resetChargeCount } from "./record";
import { catalogForGame } from "./catalog";
import { hexToBytes, bytesToHex } from "./bytes";
import { createCapture, summarize, uidFromDump } from "./dump";
import { buildReadCommands, formatCommands, parseReadResponses } from "./commands";

// Vectors copied from the Swift MedalCoreTests (published YW3 medal dump,
// Proxmark forum topic 9048 post #2, plus independent .NET vectors).
const realUID = hexToBytes("04ECDA02FE4E80");
const realCipher = hexToBytes(
  "76F4B1C2056402531FB7E90F3F557C28" + "0B9EC209D0BF04C8CA523DEE7F5E49BEC" + "691F8A44AE9ED100DF0AA1FC8895440",
);
const realPlain = hexToBytes(
  "323036384C3545000000000000000096" + "000200000000000000000000000F0112" + "000200000000000000000000000F0112",
);

describe("crypto vectors", () => {
  test("published medal: password, decrypt, encrypt", async () => {
    const keys = await deriveKeys(realUID);
    expect(bytesToHex(keys.password)).toBe("73D87A65");
    expect(await decryptAndVerify(realUID, realCipher)).toEqual(realPlain);
    expect(await crypt(realUID, realPlain)).toEqual(realCipher);
    expect(currentId(realPlain)).toBe(15);
    expect(chargeCount(realPlain)).toBe(1);
  });

  test("independent derivation and CTR vectors", async () => {
    const vectors: [string, string, string, string, string, string][] = [
      ["04A1B2C3D4E5F6", "01E8E76A", "CB0BE748535A9B6314EB505170CFF016",
       "52D2F92252B27C09104AE292A42A0600",
       "000102030405060708090A0B0C0D0E69101112131415161718191A1B1C1D1E59202122232425262728292A2B2C2D2E49",
       "A921DEDB87257CBFDEC0895EF9BF4E37598E66C76DC4049A5C29AE0436C89C99DB40C5F87A57DD809E574A69BDF4A867"],
      ["00000000000000", "91F5238E", "7444B0BD863AC4DADB82D55EE0C7CC20",
       "E6B6549617CFE754DB82D55EE0C7CC00", "00".repeat(48),
       "9CC2E9DC91C59938E1A5D43A0F2B4C87BEC1C487E6287DE13A06DE90144C8D34424BE066713C3CAE201BBC57C1C21F74"],
      ["FFFFFFFFFFFFFF", "4B67D8B4", "F9F1F8D041A5C89A637C06C788A47844",
       "C4E6C0C00AC2102E9C83F938775B8700", "00".repeat(48),
       "D6C9B36CD3917D6D37F2B6B37AB45527AE421C2773AD000F0C329772CD3AB7C4A7A4A813B37CDF4AA1AA93395593D318"],
    ];
    for (const [uidText, pwdText, keyText, ivText, plainText, cipherText] of vectors) {
      const uid = hexToBytes(uidText);
      const keys = await deriveKeys(uid);
      expect(bytesToHex(keys.password)).toBe(pwdText);
      expect(bytesToHex(keys.key)).toBe(keyText);
      expect(bytesToHex(keys.iv)).toBe(ivText);
      expect(await crypt(uid, hexToBytes(plainText))).toEqual(hexToBytes(cipherText));
      expect(await decryptAndVerify(uid, hexToBytes(cipherText))).toEqual(hexToBytes(plainText));
    }
  });
});

describe("record operations", () => {
  test("history bit order and duplication", () => {
    const zero = new Uint8Array(48);
    for (let entry = 1; entry <= 96; entry++) {
      const result = applyYouki(zero, 1, entry);
      const index = entry - 1;
      for (let byte = 0; byte < 12; byte++) {
        expect(result[16 + byte]).toBe(byte === Math.floor(index / 8) ? 1 << (7 - (index % 8)) : 0);
      }
      expect(result.slice(16, 32)).toEqual(result.slice(32, 48));
      expect(verifyChecksums(result)).toBe(true);
    }
  });

  test("entry 97 and 999 add no history; count saturates; clear preserves", () => {
    expect(bytesToHex(applyYouki(realPlain, 97, 97).slice(16, 32))).toBe("00020000000000000000000000610265");
    expect(bytesToHex(applyYouki(realPlain, 999, 0).slice(16, 32))).toBe("00020000000000000000000003E702EE");
    const bytes = new Uint8Array(realPlain);
    bytes[30] = 254; bytes[46] = 254;
    const before = withChecksums(bytes);
    const saturated = applyYouki(before, 0xffff, 96);
    expect(chargeCount(saturated)).toBe(255);
    const cleared = applyYouki(saturated, 0, 96);
    expect(currentId(cleared)).toBe(0);
    expect(chargeCount(cleared)).toBe(255);
  });

  test("reset preserves distinct records", () => {
    const bytes = new Uint8Array(realPlain);
    bytes.fill(0xff, 16, 28); bytes.fill(0xa5, 32, 44);
    bytes[28] = 0x12; bytes[29] = 0x34; bytes[30] = 255;
    bytes[44] = 0xab; bytes[45] = 0xcd; bytes[46] = 127;
    const source = withChecksums(bytes);
    const reset = resetChargeCount(source);
    expect(reset[30]).toBe(0);
    expect(reset[46]).toBe(0);
    expect(currentId(reset)).toBe(0x1234);
    expect(resetChargeCount(reset)).toEqual(reset);
  });
});

describe("catalog", () => {
  test("98 entries per game with the right exceptions", () => {
    for (const busters2 of [false, true]) {
      const entries = catalogForGame(busters2);
      expect(entries.length).toBe(98);
      expect(new Set(entries.map((e) => e.id)).size).toBe(98);
      expect(entries.some((e) => e.id === 97)).toBe(busters2);
      expect(entries.some((e) => e.id === 999)).toBe(!busters2);
    }
  });
});

describe("dump + commands round trip", () => {
  test("synthetic dump parses, diagnoses, and read responses assemble", async () => {
    // Build a plausible raw dump: header pages + signature + real cipher payload.
    const raw = new Uint8Array(180);
    raw.set([0x04, 0xec, 0xda, 0x6e, 0x02, 0xfe, 0x4e, 0x80, 0x8d], 0); // UID + BCC (0x88^04^EC^DA=6E, 02^FE^4E^80=... check below)
    raw[3] = 0x88 ^ 0x04 ^ 0xec ^ 0xda;
    raw[8] = 0x02 ^ 0xfe ^ 0x4e ^ 0x80;
    raw.set([0xf5, 0x10, 0x12, 0x00, 0x42, 0x41, 0x42, 0x4f, 0, 1, 0, 1], 12);
    raw.set(realCipher, 24);
    expect(uidFromDump(raw)).toEqual(realUID);
    const capture = await createCapture(raw, realUID, "diagnostic");
    expect(capture.plaintext).toEqual(realPlain);
    const summary = summarize(capture);
    expect(summary.aura).toBe("おうごん");
    expect(summary.chargeCount).toBe(1);

    // Simulate NFC Tools responses for the full read sequence.
    const version = hexToBytes("000404000F0300".padEnd(16, "0")); // placeholder replaced below
    version.set([0x00, 0x04, 0x04, 0x00, 0x00, 0x00, 0x0f, 0x03]);
    const parts: Uint8Array[] = [
      version,
      raw.slice(0, 16),
      hexToBytes("BEEF"),
    ];
    for (const page of [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 41]) {
      parts.push(raw.slice(page * 4, page * 4 + 16));
    }
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) { all.set(p, off); off += p.length; }
    expect(all.length).toBe(218);
    expect(parseReadResponses(all)).toEqual(raw);

    const commands = await buildReadCommands(realUID);
    expect(commands[0]).toBe("60");
    expect(commands[2]).toBe("1B73D87A65");
    expect(commands.length).toBe(15);
    expect(formatCommands(["60", "1B73D87A65", "3006"], "tools")).toBe("60,1B:73:D8:7A:65,30:06");
  });
});
