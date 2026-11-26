package jp.youki.charger

import android.nfc.tech.MifareUltralight
import java.io.IOException

/** Capture, diagnosis and NFC session, ported from the Swift MedalNfc/MedalDiagnosis. */
object MedalFormat {
    const val RAW_LENGTH = 180
    val SIGNATURE = byteArrayOf(0xF5.toByte(), 0x10, 0x12, 0x00, 0x42, 0x41, 0x42, 0x4F, 0, 1, 0, 1)
    val WRITE_ORDER = intArrayOf(14, 15, 16, 17, 10, 11, 12, 13, 6, 7, 8, 9)

    fun embeddedUID(raw: ByteArray): ByteArray =
        byteArrayOf(raw[0], raw[1], raw[2], raw[4], raw[5], raw[6], raw[7])

    fun requireUID(uid: ByteArray) {
        require(uid.size == 7 && uid[0].toInt() == 4) { "NXP製の7バイトUIDが必要です" }
    }

    fun validateIdentity(raw: ByteArray, uid: ByteArray) {
        requireUID(uid)
        require(raw.size >= 9) { "UIDページが不足しています" }
        val bcc0 = (0x88 xor (uid[0].toInt() and 0xFF) xor (uid[1].toInt() and 0xFF) xor (uid[2].toInt() and 0xFF)).toByte()
        val bcc1 = ((uid[3].toInt() and 0xFF) xor (uid[4].toInt() and 0xFF) xor (uid[5].toInt() and 0xFF) xor (uid[6].toInt() and 0xFF)).toByte()
        require(bcc0 == raw[3] && bcc1 == raw[8] && embeddedUID(raw).contentEquals(uid)) {
            "検出UIDとページ内UID、BCCが一致しません"
        }
        require(raw.size >= 24 && raw.copyOfRange(12, 24).contentEquals(SIGNATURE)) {
            "メダルの公開ヘッダーが一致しません"
        }
    }

    fun isWritable(raw: ByteArray, page: Int): Boolean = when {
        page <= 7 -> (raw[10].toInt() shr page) and 1 == 0
        page <= 15 -> (raw[11].toInt() shr (page - 8)) and 1 == 0
        else -> raw[160].toInt() and 1 == 0
    }
}

enum class IntegrityMode { STRICT, RECORD_DAMAGE, DIAGNOSTIC }

data class MedalCapture(
    val uid: ByteArray,
    val raw: ByteArray,
    val plaintext: ByteArray,
    val badChecksumBlocks: List<Int>,
) {
    val ciphertext: ByteArray get() = raw.copyOfRange(24, 72)
    val hasValidChecksums: Boolean get() = badChecksumBlocks.isEmpty()
}

class MedalException(message: String) : Exception(message)

object MedalDiagnosis {
    data class Summary(val title: String, val message: String, val aura: String, val chargeCount: Int)

    fun canRepairSingleRecord(capture: MedalCapture?): Boolean {
        if (capture == null || !MedalCrypto.blockChecksumIsValid(capture.plaintext, 0)) return false
        return MedalCrypto.blockChecksumIsValid(capture.plaintext, 16) !=
            MedalCrypto.blockChecksumIsValid(capture.plaintext, 32)
    }

    fun canResetDamagedRecords(capture: MedalCapture?): Boolean {
        if (capture == null || !MedalCrypto.blockChecksumIsValid(capture.plaintext, 0)) return false
        return !MedalCrypto.blockChecksumIsValid(capture.plaintext, 16) &&
            !MedalCrypto.blockChecksumIsValid(capture.plaintext, 32)
    }

    fun summarize(capture: MedalCapture?): Summary {
        if (capture == null) return Summary("読み取れませんでした", "メダルを離して、もう一度かざしてください。", "", -1)
        val bytes = capture.plaintext
        if (bytes.size != 48 || !MedalCrypto.blockChecksumIsValid(bytes, 0)) {
            return Summary("修復できません", "メダルの基本情報を確認できませんでした。", "", -1)
        }
        val primary = MedalCrypto.blockChecksumIsValid(bytes, 16)
        val secondary = MedalCrypto.blockChecksumIsValid(bytes, 32)
        if (!primary && !secondary) {
            return Summary("記録を作り直せます", "妖気なしの状態で作り直せます。妖気・回数・履歴は消去されます。", "", -1)
        }
        val offset = if (primary) 16 else 32
        val id = ((bytes[offset + 12].toInt() and 0xFF) shl 8) or (bytes[offset + 13].toInt() and 0xFF)
        val aura = if (id == 0) "妖気なし" else YoukiCatalog.displayName(YoukiCatalog.nameFor(id))
        val count = bytes[offset + 14].toInt() and 0xFF
        return when {
            primary != secondary ->
                Summary("修復を試せます", "残っている妖気を使って、壊れた記録を修復します。", aura, count)
            !bytes.copyOfRange(16, 32).contentEquals(bytes.copyOfRange(32, 48)) ->
                Summary("記録に違いがあります", "妖気を選んでチャージするか、バックアップから戻せます。", aura, count)
            else -> Summary("読み取りできました", "記録のチェックに問題は見つかりませんでした。", aura, count)
        }
    }

    fun repairPlaintext(capture: MedalCapture): ByteArray {
        val bad = capture.badChecksumBlocks
        check(bad.size == 1 && (bad[0] == 1 || bad[0] == 2)) { "片方のレコードだけが壊れている場合に修復できます。" }
        val survivor = if (bad[0] == 1) 2 else 1
        val repaired = capture.plaintext.copyOf()
        System.arraycopy(capture.plaintext, survivor * 16, repaired, bad[0] * 16, 16)
        check(MedalCrypto.verifyChecksums(repaired)) { "修復後のチェックサムを確認できません。" }
        return repaired
    }

    fun rebuildPlaintext(capture: MedalCapture): ByteArray {
        val bad = capture.badChecksumBlocks
        check(bad.size == 2 && bad[0] == 1 && bad[1] == 2) { "両方のレコードが壊れている場合に初期化できます。" }
        val reset = capture.plaintext.copyOf()
        reset.fill(0, 16, 48)
        val result = MedalCrypto.withChecksums(reset)
        check(MedalCrypto.verifyChecksums(result)) { "初期化後のチェックサムを確認できません。" }
        return result
    }
}

/** One NFC session against a connected MifareUltralight tag. Caller connects/closes. */
class MedalSession(private val ul: MifareUltralight) {

    private fun send(command: ByteArray, expectedMin: Int, what: String): ByteArray {
        val response: ByteArray = try {
            ul.transceive(command)
        } catch (e: IOException) {
            throw MedalException("$what に失敗しました: ${e.message}")
        }
        if (response.size < expectedMin) throw MedalException("$what の応答が短すぎます")
        return response
    }

    private fun authenticate(uid: ByteArray) {
        val password = MedalCrypto.derive(uid).password
        val pack = send(byteArrayOf(0x1B) + password, 2, "PWD_AUTH")
        if (!(pack[0] == 0xBE.toByte() && pack[1] == 0xEF.toByte())) {
            throw MedalException("PWD_AUTHの応答が想定と異なります")
        }
    }

    fun capture(expectedUID: ByteArray?, mode: IntegrityMode): MedalCapture {
        val version = send(byteArrayOf(0x60), 8, "GET_VERSION")
        if (!(version[0].toInt() == 0 && version[1].toInt() == 4 && version[2].toInt() == 4 &&
                version[6].toInt() == 0x0F && version[7].toInt() == 3)
        ) throw MedalException("NTAG213のGET_VERSION応答ではありません")

        val head = send(byteArrayOf(0x30, 0x00), 16, "READ")
        val uid = MedalFormat.embeddedUID(head)
        if (expectedUID != null && !expectedUID.contentEquals(uid)) {
            throw MedalException("別のメダルが検出されました")
        }
        val fast = send(byteArrayOf(0x3A, 0x04, 0x05), 8, "FAST READ")
        MedalFormat.validateIdentity(head.copyOf(16) + fast, uid)

        authenticate(uid)

        val raw = ByteArray(MedalFormat.RAW_LENGTH)
        for (start in listOf(0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40)) {
            val page = send(byteArrayOf(0x30, start.toByte()), 16, "READ")
            System.arraycopy(page, 0, raw, start * 4, 16)
        }
        val last = send(byteArrayOf(0x30, 41), 16, "READ")
        System.arraycopy(last, 0, raw, 164, 16)
        MedalFormat.validateIdentity(raw, uid)

        val plain = MedalCrypto.crypt(uid, raw.copyOfRange(24, 72))
        val bad = MedalCrypto.badChecksumBlocks(plain)
        val allowed = bad.isEmpty() || mode == IntegrityMode.DIAGNOSTIC ||
            (mode == IntegrityMode.RECORD_DAMAGE && !bad.contains(0))
        if (!allowed) throw MedalException("メダルのチェックサムが不正です。ブロック $bad")
        return MedalCapture(uid, raw, plain, bad)
    }

    /**
     * Writes a transformed plaintext with the Swift core's safety rules:
     * durable backup first (via [onBeforeWrite]), fresh re-capture compared
     * against [capture], one authentication, ordered page writes with
     * per-page read-back, and a final full verification capture.
     */
    fun writeTransformed(
        capture: MedalCapture,
        targetPlaintext: ByteArray,
        onBeforeWrite: (ByteArray) -> Unit,
    ): MedalCapture {
        onBeforeWrite(capture.raw)
        val fresh = capture(capture.uid, IntegrityMode.DIAGNOSTIC)
        if (!fresh.raw.contentEquals(capture.raw)) {
            throw MedalException("前回の読み取りからメダルの内容が変わっています。読み取り直してください。")
        }
        val targetCiphertext = MedalCrypto.crypt(capture.uid, targetPlaintext)
        val current = capture.ciphertext
        val changedPages = MedalFormat.WRITE_ORDER.filter { page ->
            val offset = (page - 6) * 4
            !current.copyOfRange(offset, offset + 4).contentEquals(targetCiphertext.copyOfRange(offset, offset + 4))
        }
        for (page in changedPages) {
            if (!MedalFormat.isWritable(capture.raw, page)) throw MedalException("ページ${page}は書込みロックされています")
        }
        for (page in changedPages) {
            val offset = (page - 6) * 4
            val data = targetCiphertext.copyOfRange(offset, offset + 4)
            val ack = send(byteArrayOf(0xA2.toByte(), page.toByte()) + data, 1, "WRITE")
            if (ack[0] != 0x0A.toByte()) throw MedalException("ページ${page}の書込み応答がACKではありません")
            val readBack = send(byteArrayOf(0x30, page.toByte()), 16, "READ")
            if (!readBack.copyOfRange(0, 4).contentEquals(data)) {
                throw MedalException("ページ${page}の読み戻しが一致しません")
            }
        }
        val verified = capture(capture.uid, IntegrityMode.DIAGNOSTIC)
        if (!verified.ciphertext.contentEquals(targetCiphertext)) {
            throw MedalException("最終確認で目標データと一致しませんでした")
        }
        return verified
    }
}
