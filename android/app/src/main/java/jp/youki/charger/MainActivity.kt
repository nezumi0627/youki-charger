package jp.youki.charger

import android.app.Activity
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.MifareUltralight
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Beta UI: pick an operation, then hold the medal to the phone.
 * Read is the default operation; write operations re-verify the medal
 * against the last read before touching it (same rules as the iOS core).
 */
class MainActivity : Activity() {

    private enum class PendingOp { READ, CHARGE, RESET, REPAIR, REBUILD, RESTORE }

    private lateinit var statusText: TextView
    private lateinit var auraText: TextView
    private lateinit var countText: TextView
    private lateinit var diagnosisText: TextView
    private lateinit var entryList: ListView
    private lateinit var gameGroup: RadioGroup
    private lateinit var chargeButton: Button
    private lateinit var resetButton: Button
    private lateinit var repairButton: Button
    private lateinit var rebuildButton: Button
    private lateinit var restoreButton: Button

    private var adapter: NfcAdapter? = null
    private var capture: MedalCapture? = null
    private var restoreSource: MedalCapture? = null
    private var pendingOp: PendingOp = PendingOp.READ
    private var selectedEntry: YoukiEntry? = null
    private var entries: List<YoukiEntry> = emptyList()

    private val backupDir: File by lazy { File(filesDir, "backups").apply { mkdirs() } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        adapter = NfcAdapter.getDefaultAdapter(this)
        buildUi()
        refreshEntries()
        setStatus("操作を選んで、メダルをかざしてください（既定は読み取り）")
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 32, 32, 32) }
        fun label(text: String, size: Float = 14f, bold: Boolean = false) = TextView(this).apply {
            this.text = text; textSize = size; if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        root.addView(label("妖気チャージ", 24f, true))
        statusText = label(""); root.addView(statusText)
        auraText = label("現在の妖気: —", 18f, true); root.addView(auraText)
        countText = label("チャージ回数: —"); root.addView(countText)
        diagnosisText = label(""); root.addView(diagnosisText)

        gameGroup = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        val yw3 = RadioButton(this).apply { id = View.generateViewId(); text = "妖怪ウォッチ3" }
        val b2 = RadioButton(this).apply { id = View.generateViewId(); text = "バスターズ2" }
        gameGroup.addView(yw3); gameGroup.addView(b2); gameGroup.check(yw3.id)
        gameGroup.setOnCheckedChangeListener { _, _ -> refreshEntries() }
        root.addView(gameGroup)

        val search = EditText(this).apply { hint = "妖気名で検索" }
        search.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) = refreshEntries(s?.toString()?.trim() ?: "")
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })
        root.addView(search)

        entryList = ListView(this).apply { layoutParams = LinearLayout.LayoutParams(-1, 480) }
        entryList.setOnItemClickListener { _, _, position, _ ->
            selectedEntry = entries.getOrNull(position)
            setStatus("選択中: ${selectedEntry?.let { YoukiCatalog.displayName(it.name) } ?: "—"}")
        }
        root.addView(entryList)

        fun actionButton(text: String, op: PendingOp) = Button(this).apply {
            this.text = text
            setOnClickListener { pendingOp = op; setStatus("「$text」を待機中。メダルをかざしてください") }
        }
        root.addView(actionButton("読み取り", PendingOp.READ))
        chargeButton = actionButton("チャージ", PendingOp.CHARGE); root.addView(chargeButton)
        resetButton = actionButton("チャージ回数を0に戻す", PendingOp.RESET); root.addView(resetButton)
        repairButton = actionButton("メダルを修復", PendingOp.REPAIR); root.addView(repairButton)
        rebuildButton = actionButton("妖気なしで作り直す", PendingOp.REBUILD); root.addView(rebuildButton)
        restoreButton = actionButton("バックアップを復元", PendingOp.RESTORE); root.addView(restoreButton)

        val pickRestore = Button(this).apply {
            text = "復元元のバックアップを選ぶ"
            setOnClickListener {
                startActivityForResult(
                    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        type = "application/octet-stream"; addCategory(Intent.CATEGORY_OPENABLE)
                    }, REQUEST_RESTORE_FILE,
                )
            }
        }
        root.addView(pickRestore)
        val exportBackup = Button(this).apply {
            text = "最後の読み取りを .bin で書き出す"
            setOnClickListener {
                if (capture == null) { setStatus("先に読み取ってください"); return@setOnClickListener }
                startActivityForResult(
                    Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        type = "application/octet-stream"
                        putExtra(Intent.EXTRA_TITLE, "妖気メダル_${stamp()}.bin")
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }, REQUEST_EXPORT_FILE,
                )
            }
        }
        root.addView(exportBackup)
        root.addView(label("書き込みの前には内部バックアップを自動保存します。NFCが使えない端末では読み取り・書き込みはできません。", 12f))

        setContentView(ScrollView(this).apply { addView(root) })
        updateButtons()
    }

    private fun isBusters2(): Boolean {
        val checked = gameGroup.checkedRadioButtonId
        return checked != -1 && (gameGroup.getChildAt(1) as RadioButton).id == checked
    }

    private fun refreshEntries(query: String = "") {
        val all = YoukiCatalog.forGame(isBusters2())
        entries = if (query.isEmpty()) all else all.filter { it.name.contains(query) }
        entryList.adapter = ArrayAdapter(
            this, android.R.layout.simple_list_item_1,
            entries.map { if (it.id == 0) "妖気なし" else YoukiCatalog.displayName(it.name) },
        )
        if (selectedEntry == null || entries.none { it.id == selectedEntry?.id }) selectedEntry = entries.firstOrNull()
    }

    override fun onResume() {
        super.onResume()
        adapter?.enableReaderMode(
            this,
            { tag -> onTag(tag) },
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null,
        )
    }

    override fun onPause() {
        super.onPause()
        adapter?.disableReaderMode(this)
    }

    private fun onTag(tag: Tag) {
        val ul = MifareUltralight.get(tag) ?: run {
            runOnUiThread { setStatus("MIFARE Ultralightではないタグです") }
            return
        }
        val op = pendingOp
        thread {
            try {
                ul.connect()
                val session = MedalSession(ul)
                when (op) {
                    PendingOp.READ -> {
                        val result = session.capture(null, IntegrityMode.DIAGNOSTIC)
                        saveInternalBackup(result.raw, "read")
                        runOnUiThread { adoptCapture(result); setStatus("読み取りました") }
                    }
                    PendingOp.CHARGE, PendingOp.RESET, PendingOp.REPAIR, PendingOp.REBUILD, PendingOp.RESTORE -> {
                        val current = capture ?: throw MedalException("先に読み取りをしてください")
                        val target: ByteArray = when (op) {
                            PendingOp.CHARGE -> {
                                val entry = selectedEntry ?: throw MedalException("妖気を選んでください")
                                YoukiRecord.apply(current.plaintext, entry.id, entry.entryNumber)
                            }
                            PendingOp.RESET -> YoukiRecord.resetChargeCount(current.plaintext)
                            PendingOp.REPAIR -> MedalDiagnosis.repairPlaintext(current)
                            PendingOp.REBUILD -> MedalDiagnosis.rebuildPlaintext(current)
                            PendingOp.RESTORE -> {
                                val source = restoreSource ?: throw MedalException("復元元のバックアップを選んでください")
                                if (!source.uid.contentEquals(current.uid)) throw MedalException("別のメダルのバックアップは復元できません")
                                source.plaintext
                            }
                            else -> error("unreachable")
                        }
                        val verified = session.writeTransformed(current, target) { raw ->
                            saveInternalBackup(raw, "before-write")
                        }
                        runOnUiThread { adoptCapture(verified); setStatus("完了し、最終確認まで一致しました") }
                    }
                }
            } catch (e: Exception) {
                runOnUiThread { setStatus("失敗: ${e.message}") }
            } finally {
                try { ul.close() } catch (_: Exception) {}
                pendingOp = PendingOp.READ
            }
        }
    }

    private fun adoptCapture(result: MedalCapture) {
        capture = result
        val summary = MedalDiagnosis.summarize(result)
        auraText.text = "現在の妖気: ${summary.aura.ifEmpty { "—" }}"
        countText.text = "チャージ回数: ${if (summary.chargeCount < 0) "—" else "${summary.chargeCount} 回"}"
        diagnosisText.text = "${summary.title}: ${summary.message}" +
            if (result.badChecksumBlocks.isNotEmpty()) "（不一致ブロック: ${result.badChecksumBlocks.joinToString(",")}）" else ""
        updateButtons()
    }

    private fun updateButtons() {
        val valid = capture?.hasValidChecksums == true
        chargeButton.isEnabled = valid
        resetButton.isEnabled = valid
        repairButton.isEnabled = MedalDiagnosis.canRepairSingleRecord(capture)
        rebuildButton.isEnabled = MedalDiagnosis.canResetDamagedRecords(capture)
        restoreButton.isEnabled = capture != null && restoreSource != null
    }

    private fun setStatus(text: String) { statusText.text = text }

    private fun stamp(): String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

    private fun saveInternalBackup(raw: ByteArray, kind: String) {
        File(backupDir, "${kind}_${stamp()}.bin").writeBytes(raw)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        when (requestCode) {
            REQUEST_RESTORE_FILE -> thread {
                try {
                    val bytes = contentResolver.openInputStream(uri)?.readBytes()
                        ?: throw MedalException("ファイルを読めません")
                    require(bytes.size == MedalFormat.RAW_LENGTH) { "180バイトのダンプファイルを選んでください" }
                    val uid = MedalFormat.embeddedUID(bytes)
                    MedalFormat.validateIdentity(bytes, uid)
                    val plain = MedalCrypto.decryptAndVerify(uid, bytes.copyOfRange(24, 72))
                    restoreSource = MedalCapture(uid, bytes, plain, emptyList())
                    runOnUiThread { setStatus("復元元を取り込みました"); updateButtons() }
                } catch (e: Exception) {
                    runOnUiThread { setStatus("取り込み失敗: ${e.message}") }
                }
            }
            REQUEST_EXPORT_FILE -> {
                val raw = capture?.raw ?: return
                contentResolver.openOutputStream(uri)?.use { it.write(raw) }
                setStatus("書き出しました")
            }
        }
    }

    companion object {
        private const val REQUEST_RESTORE_FILE = 1001
        private const val REQUEST_EXPORT_FILE = 1002
    }
}
