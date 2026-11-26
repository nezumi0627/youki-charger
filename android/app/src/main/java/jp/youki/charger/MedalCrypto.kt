package jp.youki.charger

import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Medal cryptography, ported from the shared core (Swift MedalCrypto).
 * Derivation: HMAC-SHA256 x2 with a nibble S-box between them.
 * Cipher: AES-128-CTR, big-endian counter, no padding (symmetric).
 */
object MedalCrypto {
    const val UID_LENGTH = 7
    const val DATA_LENGTH = 48
    const val BLOCK_LENGTH = 16

    private val KEY1 = "SjqjE90z8w".toByteArray(Charsets.US_ASCII)
    private val KEY2 = "bYYw75Ks9K".toByteArray(Charsets.US_ASCII)
    private val SBOX = intArrayOf(14, 2, 11, 7, 5, 0, 12, 8, 10, 13, 15, 4, 6, 3, 1, 9)

    data class Keys(val password: ByteArray, val key: ByteArray, val iv: ByteArray)

    private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    fun derive(uid: ByteArray): Keys {
        require(uid.size == UID_LENGTH) { "UIDは${UID_LENGTH}バイト必要です" }
        val h1 = hmacSha256(KEY1, uid)
        for (i in h1.indices) {
            val b = h1[i].toInt() and 0xFF
            h1[i] = ((SBOX[b shr 4] shl 4) or SBOX[b and 15]).toByte()
        }
        val h2 = hmacSha256(KEY2, h1)
        val iv = ByteArray(16)
        System.arraycopy(h2, 24, iv, 0, 8)
        System.arraycopy(uid, 0, iv, 8, 7)
        iv[15] = 0
        for (i in 0 until 15) iv[i] = (iv[i].toInt() xor h2[i].toInt()).toByte()
        return Keys(h2.copyOfRange(28, 32), h2.copyOfRange(0, 16), iv)
    }

    fun crypt(uid: ByteArray, data: ByteArray): ByteArray {
        require(data.size == DATA_LENGTH) { "保護データは${DATA_LENGTH}バイト必要です" }
        val keys = derive(uid)
        val cipher = Cipher.getInstance("AES/CTR/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keys.key, "AES"), IvParameterSpec(keys.iv))
        return cipher.doFinal(data)
    }

    fun decryptAndVerify(uid: ByteArray, ciphertext: ByteArray): ByteArray {
        val plain = crypt(uid, ciphertext)
        check(verifyChecksums(plain)) { "保護データのチェックサムが一致しません。" }
        return plain
    }

    fun checksumByte(bytes: ByteArray, offset: Int): Int {
        var sum = 0
        for (i in offset until offset + BLOCK_LENGTH - 1) sum += bytes[i].toInt() and 0xFF
        return sum and 0xFF
    }

    fun blockChecksumIsValid(bytes: ByteArray, offset: Int): Boolean {
        if (offset < 0 || bytes.size < offset + BLOCK_LENGTH) return false
        return checksumByte(bytes, offset) == (bytes[offset + BLOCK_LENGTH - 1].toInt() and 0xFF)
    }

    fun badChecksumBlocks(plain: ByteArray): List<Int> =
        (0 until DATA_LENGTH / BLOCK_LENGTH).filter { !blockChecksumIsValid(plain, it * BLOCK_LENGTH) }

    fun verifyChecksums(plain: ByteArray): Boolean =
        plain.size == DATA_LENGTH && badChecksumBlocks(plain).isEmpty()

    fun withChecksums(plain: ByteArray): ByteArray {
        require(plain.size == DATA_LENGTH) { "平文は${DATA_LENGTH}バイト必要です" }
        val out = plain.copyOf()
        var offset = 0
        while (offset < DATA_LENGTH) {
            out[offset + BLOCK_LENGTH - 1] = checksumByte(out, offset).toByte()
            offset += BLOCK_LENGTH
        }
        return out
    }
}

/** Record operations, ported from YoukiRecord. */
object YoukiRecord {
    private const val RECORD_OFFSET = 16
    private const val RECORD_LENGTH = 16
    private const val ID_OFFSET = 12
    private const val COUNT_OFFSET = 14
    private const val CHECKSUM_OFFSET = 15
    private const val MAX_HISTORY_ENTRY = 96
    const val MAX_ENTRY_NUMBER = 97

    private fun requireValidPlain(plain: ByteArray) {
        require(plain.size == MedalCrypto.DATA_LENGTH) { "平文は48バイト必要です" }
        check(MedalCrypto.verifyChecksums(plain)) { "保護データのチェックサムが一致しません。" }
    }

    fun apply(plain: ByteArray, id: Int, entryNumber: Int): ByteArray {
        requireValidPlain(plain)
        require(id in 0..0xFFFF) { "妖気IDは0〜65535の範囲で指定してください。" }
        require(entryNumber in 0..MAX_ENTRY_NUMBER) { "履歴番号は0〜97の範囲で指定してください。" }
        val result = plain.copyOf()
        val record = result.copyOfRange(RECORD_OFFSET, RECORD_OFFSET + RECORD_LENGTH)
        record[ID_OFFSET] = (id shr 8).toByte()
        record[ID_OFFSET + 1] = id.toByte()
        if (id != 0) {
            record[COUNT_OFFSET] = minOf(255, (record[COUNT_OFFSET].toInt() and 0xFF) + 1).toByte()
            if (entryNumber in 1..MAX_HISTORY_ENTRY) {
                val index = entryNumber - 1
                record[index / 8] = ((record[index / 8].toInt() and 0xFF) or (1 shl (7 - index % 8))).toByte()
            }
        }
        record[CHECKSUM_OFFSET] = MedalCrypto.checksumByte(record, 0).toByte()
        System.arraycopy(record, 0, result, RECORD_OFFSET, RECORD_LENGTH)
        System.arraycopy(record, 0, result, RECORD_OFFSET + RECORD_LENGTH, RECORD_LENGTH)
        return result
    }

    fun resetChargeCount(plain: ByteArray): ByteArray {
        requireValidPlain(plain)
        val result = plain.copyOf()
        for (slot in 0 until 2) {
            val offset = RECORD_OFFSET + slot * RECORD_LENGTH
            result[offset + COUNT_OFFSET] = 0
            result[offset + CHECKSUM_OFFSET] = MedalCrypto.checksumByte(result, offset).toByte()
        }
        return result
    }

    fun currentId(plain: ByteArray): Int {
        requireValidPlain(plain)
        return ((plain[RECORD_OFFSET + ID_OFFSET].toInt() and 0xFF) shl 8) or
            (plain[RECORD_OFFSET + ID_OFFSET + 1].toInt() and 0xFF)
    }

    fun chargeCount(plain: ByteArray): Int {
        requireValidPlain(plain)
        return plain[RECORD_OFFSET + COUNT_OFFSET].toInt() and 0xFF
    }
}
