import { useEffect, useMemo, useState } from "react";
import { bytesEqual, bytesToHex, extractHexBytes, hexToBytes } from "./core/bytes";
import { catalogForGame, displayName } from "./core/catalog";
import { applyYouki, resetChargeCount } from "./core/record";
import {
  canRepairSingleRecord,
  canResetDamagedRecords,
  createCapture,
  captureCiphertext,
  hasValidChecksums,
  repairPlaintext,
  rebuildPlaintext,
  summarize,
  uidFromDump,
  type DiagnosisSummary,
  type MedalCapture,
} from "./core/dump";
import {
  authCommand,
  buildNoOpTestPlan,
  buildReadCommands,
  buildWritePlan,
  formatCommands,
  parseReadResponses,
  type CommandFormat,
  type WritePlan,
} from "./core/commands";

type FormatStyle = CommandFormat;

const UID_KEY = "youki.uid";
const RAW_KEY = "youki.lastRawHex";

function parseUID(text: string): Uint8Array | null {
  const clean = text.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length !== 14) return null;
  try {
    const uid = hexToBytes(clean);
    return uid[0] === 0x04 ? uid : null;
  } catch {
    return null;
  }
}

async function copyText(text: string, setDone: (v: string) => void, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    setDone(`${label}をコピーしました`);
  } catch {
    setDone("コピーできませんでした。テキストを選択してコピーしてください。");
  }
}

function downloadBin(data: Uint8Array, filename: string) {
  const blob = new Blob([data as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default function App() {
  const [uidText, setUidText] = useState(() => localStorage.getItem(UID_KEY) ?? "");
  const uid = useMemo(() => parseUID(uidText), [uidText]);
  const [format, setFormat] = useState<FormatStyle>("tools");
  const [copied, setCopied] = useState("");
  const [readHint, setReadHint] = useState("");
  const [writeHint, setWriteHint] = useState("");
  const [themeMode, setThemeMode] = useState<"dark" | "light" | "auto">(
    () => (localStorage.getItem("youki-theme") as "dark" | "light" | "auto" | null) ?? "dark",
  );

  useEffect(() => {
    localStorage.setItem("youki-theme", themeMode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = themeMode === "auto" ? (mq.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#000000" : "#ffffff");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themeMode]);

  const [readCommands, setReadCommands] = useState<string[]>([]);
  const [authTestCommands, setAuthTestCommands] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [capture, setCapture] = useState<MedalCapture | null>(null);
  const [summary, setSummary] = useState<DiagnosisSummary | null>(null);
  const [parseError, setParseError] = useState("");

  const [game, setGame] = useState(0);
  const [selectedID, setSelectedID] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(0);

  const [restoreSource, setRestoreSource] = useState<MedalCapture | null>(null);
  const [plan, setPlan] = useState<WritePlan | null>(null);
  const [planLabel, setPlanLabel] = useState("");
  const [planError, setPlanError] = useState("");
  const [verifyPaste, setVerifyPaste] = useState("");
  const [verifyResult, setVerifyResult] = useState("");

  const entries = useMemo(() => catalogForGame(game === 1), [game]);
  const selectedEntry = entries.find((e) => e.id === selectedID) ?? entries[0];
  const filtered = entries.filter((e) => {
    const matchesCategory = category === 0 || (category === 1 ? !e.isEnhanced : e.isEnhanced);
    const q = search.trim();
    return matchesCategory && (q === "" || e.name.includes(q));
  });
  const canRepair = canRepairSingleRecord(capture);
  const canRebuild = canResetDamagedRecords(capture);
  const captureValid = capture !== null && hasValidChecksums(capture);

  useEffect(() => {
    localStorage.setItem(UID_KEY, uidText);
  }, [uidText]);

  useEffect(() => {
    let cancelled = false;
    if (!uid) {
      setReadCommands([]);
      setAuthTestCommands([]);
      return;
    }
    (async () => {
      const [read, auth] = await Promise.all([buildReadCommands(uid), authCommand(uid)]);
      if (cancelled) return;
      setReadCommands(read);
      setAuthTestCommands(["60", auth, "3006"]);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Restore the last parsed dump on reload.
  useEffect(() => {
    const saved = localStorage.getItem(RAW_KEY);
    if (!saved) return;
    (async () => {
      try {
        const raw = hexToBytes(saved);
        const restored = await createCapture(raw, uidFromDump(raw), "diagnostic");
        setCapture(restored);
        setSummary(summarize(restored));
      } catch {
        localStorage.removeItem(RAW_KEY);
      }
    })();
  }, []);

  async function adoptCapture(next: MedalCapture) {
    setCapture(next);
    setSummary(summarize(next));
    setPlan(null);
    setVerifyResult("");
    localStorage.setItem(RAW_KEY, bytesToHex(next.raw));
    if (!uidText) setUidText(bytesToHex(next.uid));
    scrollToStep("step3");
  }

  async function handleParsePaste() {
    setParseError("");
    try {
      const bytes = extractHexBytes(paste);
      const raw = parseReadResponses(bytes);
      const parsed = await createCapture(raw, uidFromDump(raw), "diagnostic");
      if (uid && !bytesEqual(uid, parsed.uid)) {
        setParseError("注意: 入力したUIDと、読み取ったデータのUIDが違います。読み取ったデータ側で解析しました。");
      }
      await adoptCapture(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleBinFile(file: File, kind: "capture" | "restore") {
    setParseError("");
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      if (data.length !== 180) throw new Error("180バイトのダンプファイルを選んでください。");
      const parsed = await createCapture(data, uidFromDump(data), kind === "restore" ? "strict" : "diagnostic");
      if (kind === "restore") {
        if (!hasValidChecksums(parsed)) throw new Error("チェックサムが破損したデータは復元元に使えません。");
        setRestoreSource(parsed);
      } else {
        await adoptCapture(parsed);
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  async function makePlan(kind: "charge" | "reset" | "repair" | "rebuild" | "restore" | "noop") {
    if (!capture) return;
    setPlanError("");
    setVerifyResult("");
    try {
      if (kind === "noop") {
        const commands = await buildNoOpTestPlan(capture);
        setPlan({ commands, verifyCommands: [], changedPages: [], targetCiphertext: captureCiphertext(capture) });
        setPlanLabel("無害テスト（ページ6を同じ内容で書き戻し）");
        scrollToStep("step4");
        return;
      }
      let targetPlain: Uint8Array;
      let label: string;
      switch (kind) {
        case "charge":
          targetPlain = applyYouki(capture.plaintext, selectedEntry.id, selectedEntry.entryNumber);
          label = selectedEntry.id === 0 ? "妖気なしに戻す" : `チャージ: ${displayName(selectedEntry.name)}`;
          break;
        case "reset":
          targetPlain = resetChargeCount(capture.plaintext);
          label = "チャージ回数を0に戻す";
          break;
        case "repair":
          targetPlain = repairPlaintext(capture);
          label = "メダルを修復";
          break;
        case "rebuild":
          targetPlain = rebuildPlaintext(capture);
          label = "妖気なしで作り直す";
          break;
        case "restore":
          if (!restoreSource) throw new Error("先に復元元のバックアップを選んでください。");
          if (!bytesEqual(restoreSource.uid, capture.uid)) throw new Error("別のメダルのバックアップは復元できません。");
          targetPlain = restoreSource.plaintext;
          label = "バックアップを復元";
          break;
      }
      const next = await buildWritePlan(capture, targetPlain);
      // Safety rule from the native app: always save the pre-write dump first.
      downloadBin(capture.raw, `妖気バックアップ_${stamp()}.bin`);
      setPlan(next);
      setPlanLabel(label);
      scrollToStep("step4");
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleVerify() {
    if (!plan || !capture) return;
    try {
      const raw = parseReadResponses(extractHexBytes(verifyPaste));
      const after = await createCapture(raw, uidFromDump(raw), "diagnostic");
      const ok = bytesEqual(captureCiphertext(after), plan.targetCiphertext);
      setVerifyResult(
        ok
          ? "照合OK: 書き込んだ内容がメダル上のデータと一致しました。"
          : "照合NG: 目標データと一致しません。メダルを離して、もう一度読み取りからやり直してください。",
      );
      if (ok) await adoptCapture(after);
    } catch (e) {
      setVerifyResult(e instanceof Error ? e.message : String(e));
    }
  }

  const formatPicker = (
    <div className="segmented" role="group" aria-label="コピー形式">
      {(["tools", "colonLines", "plain"] as FormatStyle[]).map((style) => (
        <button key={style} className={format === style ? "selected" : ""} onClick={() => setFormat(style)}>
          {style === "tools" ? "NFC Tools" : style === "colonLines" ? "1行ずつ" : "コロンなし"}
        </button>
      ))}
    </div>
  );

  const scrollToStep = (id: string) => {
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const progressSteps = [
    { id: "step1", label: "UID", done: uid !== null },
    { id: "step2", label: "読み取り", done: capture !== null },
    { id: "step3", label: "操作", done: plan !== null },
    { id: "step4", label: "書き込み", done: verifyResult.startsWith("照合OK") },
  ];
  const activeStep = progressSteps.findIndex((s) => !s.done);

  return (
    <>
      <header className="app-header">
        <div className="inner">
          <h1>妖気チャージ Web</h1>
          <p>
            妖気メダルの解析とコマンド生成を行うページです。NFC通信は NFC Tools に委譲し、データは端末内だけで処理します。<a href="#guide">使い方と無料範囲</a>
          </p>
          <div className="segmented theme-switch" role="group" aria-label="テーマ">
            <button type="button" className={themeMode === "dark" ? "selected" : ""} onClick={() => setThemeMode("dark")}>ダーク</button>
            <button type="button" className={themeMode === "light" ? "selected" : ""} onClick={() => setThemeMode("light")}>ライト</button>
            <button type="button" className={themeMode === "auto" ? "selected" : ""} onClick={() => setThemeMode("auto")}>自動</button>
          </div>
        </div>
      </header>
      <main>
      {copied && <p className="ok">{copied}</p>}
      <nav className="progress" aria-label="進捗">
        {progressSteps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`pstep${s.done ? " done" : ""}${i === activeStep ? " active" : ""}`}
            onClick={() => scrollToStep(s.id)}
          >
            <span className="num">{s.done ? "✓" : i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <section className="card" id="step1">
        <span className="step">STEP 1{uid && " ✓"}</span>
        <h2>メダルのUID</h2>
        <p className="flow-hint">NFC Tools でタグを読み、表示された UID を入力してください。</p>
        <label htmlFor="uid">UID（7バイトのHEX）</label>
        <input
          id="uid"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          placeholder="例: 04ECDA02FE4E80"
          value={uidText}
          onChange={(e) => setUidText(e.target.value)}
        />
        {uidText && !uid && <p className="error">UIDは「04」で始まる14桁のHEXで入力してください。</p>}
        {uid && <p className="note">このUIDから認証パスワードと暗号鍵を導出します。</p>}

        <details>
          <summary>実機検証: 認証テスト（書き込みなし）</summary>
          <p className="note">
            まずこの3コマンドを NFC Tools で連続実行し、2番目の応答が <code>BEEF</code>、3番目で16バイト読めれば、
            「同一セッションで認証が維持される」ことが確認できます。メダルの内容は変わりません。
          </p>
          {formatPicker}
          <textarea readOnly value={uid ? formatCommands(authTestCommands, format) : "UIDを入力すると生成されます"} />
          <button disabled={!uid} onClick={() => copyText(formatCommands(authTestCommands, format), setCopied, "認証テストコマンド")}>
            認証テストコマンドをコピー
          </button>
        </details>
      </section>

      <section className="card" id="step2">
        <span className="step">STEP 2{capture && " ✓"}</span>
        <h2>メダルを読み取る</h2>
        <p className="flow-hint">1. コマンドをコピー → 2. NFC Tools で送信 → 3. 応答を貼って解析</p>
        <p className="note">NFC Tools の場所: Other → Advanced NFC commands（I/O class は NfcA）。応答をコピーできない場合は、メモリ読み取りからダンプ（.bin）を書き出して下の取り込みでも解析できます。</p>
        {formatPicker}
        <textarea readOnly value={uid ? formatCommands(readCommands, format) : "UIDを入力すると生成されます"} />
        <button disabled={!uid} onClick={() => { copyText(formatCommands(readCommands, format), setCopied, "読込コマンド"); setReadHint("NFC Tools で送信してください。終わったら応答を下の欄に貼って「解析する」を押します。"); }}>
          読込コマンドをコピー
        </button>
        {readHint && <p className="ok">{readHint}</p>}
        <label htmlFor="paste">NFC Toolsの応答（HEX）</label>
        <textarea
          id="paste"
          placeholder="応答のHEXをここに貼り付け"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button className="primary" disabled={!paste} onClick={handleParsePaste}>
          解析する
        </button>
        <label className="file-btn">
          ダンプ（.bin）を取り込む
          <input
            type="file"
            accept=".bin,application/octet-stream"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBinFile(f, "capture");
              e.target.value = "";
            }}
          />
        </label>
        {parseError && <p className="error">{parseError}</p>}
        {capture && summary && (
          <div className="status-box">
            <p className="kv">現在の妖気</p>
            <p className="aura">{summary.aura === "" ? "—" : summary.aura}</p>
            <p>
              チャージ回数 {summary.chargeCount < 0 ? "—" : `${summary.chargeCount} 回`}
              <span className="kv"> / UID {bytesToHex(capture.uid)}</span>
            </p>
            <p>
              {summary.title}: {summary.message}
            </p>
            {capture.badChecksumBlocks.length > 0 && (
              <p className="error">チェックサム不一致のブロック: {capture.badChecksumBlocks.join(", ")}</p>
            )}
            <button onClick={() => downloadBin(capture.raw, `妖気メダル_${stamp()}.bin`)}>
              このデータを .bin で保存
            </button>
          </div>
        )}
      </section>

      <section className="card" id="step3">
        <span className="step">STEP 3{plan && " ✓"}</span>
        <h2>操作を選ぶ</h2>
        {!capture && <p className="note">先に STEP 2 でメダルを読み取ってください。</p>}
        <div className="segmented" role="group" aria-label="遊ぶゲーム">
          <button className={game === 0 ? "selected" : ""} onClick={() => setGame(0)}>
            妖怪ウォッチ3
          </button>
          <button className={game === 1 ? "selected" : ""} onClick={() => setGame(1)}>
            バスターズ2
          </button>
        </div>
        <label htmlFor="search">妖気を選ぶ（選択中: {selectedEntry ? displayName(selectedEntry.name) : "—"}）</label>
        <input
          id="search"
          className="plain"
          type="text"
          placeholder="妖気名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="segmented" role="group" aria-label="妖気の種類">
          {["全部", "通常", "強化"].map((label, i) => (
            <button key={label} className={category === i ? "selected" : ""} onClick={() => setCategory(i)}>
              {label}
            </button>
          ))}
        </div>
        <ul className="youki-list">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className={entry.id === selectedID ? "selected" : ""}
              onClick={() => setSelectedID(entry.id)}
            >
              <span>{entry.id === 0 ? "妖気なし" : displayName(entry.name)}</span>
              {entry.id === selectedID && <span className="check">✓</span>}
            </li>
          ))}
          {filtered.length === 0 && <li>該当する妖気がありません</li>}
        </ul>

        <button className="primary" disabled={!captureValid} onClick={() => makePlan("charge")}>
          {selectedID === 0 ? "妖気なしに戻すコマンドを生成" : "チャージコマンドを生成"}
        </button>
        <button disabled={!captureValid} onClick={() => makePlan("reset")}>
          回数を0に戻すコマンドを生成
        </button>
        {canRepair && (
          <button disabled={!capture} onClick={() => makePlan("repair")}>
            修復コマンドを生成
          </button>
        )}
        {canRebuild && (
          <button disabled={!capture} onClick={() => makePlan("rebuild")}>
            妖気なしで作り直すコマンドを生成
          </button>
        )}
        <label className="file-btn">
          復元元のバックアップ（.bin）を選ぶ
          <input
            type="file"
            accept=".bin,application/octet-stream"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBinFile(f, "restore");
              e.target.value = "";
            }}
          />
        </label>
        {restoreSource && (
          <button disabled={!capture} onClick={() => makePlan("restore")}>
            復元コマンドを生成
          </button>
        )}
        <details>
          <summary>実機検証: 無害な書き込みテスト</summary>
          <p className="note">
            ページ6を「今と同じ内容」で書き戻すコマンドです。内容は変わりません。
            認証→書き込み→読み戻しが1回の実行で成立するかを確認できます。
          </p>
          <button disabled={!capture} onClick={() => makePlan("noop")}>
            無害テストコマンドを生成
          </button>
        </details>
        {planError && <p className="error">{planError}</p>}
      </section>

      <section className="card" id="step4">
        <span className="step">STEP 4{verifyResult.startsWith("照合OK") && " ✓"}</span>
        <h2>書き込みと確認</h2>
        {!plan && <p className="note">STEP 3 でコマンドを生成すると、ここに表示されます。生成時に書込み前のバックアップ（.bin）が自動で保存されます。</p>}
        {plan && (
          <div>
            <p>
              {planLabel}
              {plan.changedPages.length > 0 && (
                <span className="kv"> / 変更ページ: {plan.changedPages.join(", ")}</span>
              )}
            </p>
            <p className="error">実行中は完了までメダルを離さないでください。</p>
            <p className="flow-hint">1. 書込コマンドをコピー → 2. NFC Tools で送信 → 3. 照合コマンドで確認</p>
            {formatPicker}
            <textarea readOnly value={formatCommands(plan.commands, format)} />
            <button className="primary" onClick={() => { copyText(formatCommands(plan.commands, format), setCopied, "書込コマンド"); setWriteHint("NFC Tools で送信してください。終わったら下の照合コマンドも実行します。"); }}>
              書込コマンドをコピー
            </button>
            {writeHint && <p className="ok">{writeHint}</p>}
            {plan.verifyCommands.length > 0 && (
              <>
                <label>照合用の読込コマンド（書込み後に、もう一度かざして実行）</label>
                <textarea readOnly value={formatCommands(plan.verifyCommands, format)} />
                <button onClick={() => { copyText(formatCommands(plan.verifyCommands, format), setCopied, "照合コマンド"); setWriteHint("NFC Tools で送信し、応答を下の欄に貼って「照合する」を押してください。"); }}>
                  照合コマンドをコピー
                </button>
              </>
            )}
            <label htmlFor="verify">照合コマンドの応答を貼り付けて照合</label>
            <textarea
              id="verify"
              placeholder="照合コマンドの応答HEX"
              value={verifyPaste}
              onChange={(e) => setVerifyPaste(e.target.value)}
            />
            <button disabled={!verifyPaste} onClick={handleVerify}>
              照合する
            </button>
            {verifyResult && <p className={verifyResult.startsWith("照合OK") ? "ok" : "error"}>{verifyResult}</p>}
          </div>
        )}
      </section>

      <section className="card" id="guide">
        <h2>iOS: NFC Tools の使い方と無料範囲</h2>
        <p className="note">
          iOSでは、このページが作るコマンドを NFC Tools（wakdev）の Advanced NFC Commands で実行します。
          STEP 1〜4 がその手順です。まず NFC Tools を入れてください（App Store、無料）。
        </p>
        <details>
          <summary>使い方（初回セットアップと実行の流れ）</summary>
          <ol>
            <li>NFC Tools を開き、下部の「Other」→「Advanced NFC commands」を選ぶ</li>
            <li>初回は免責の確認（I Understand）をタップする</li>
            <li>I/O class は <strong>NfcA</strong> を選ぶ</li>
            <li>このページでコピーしたコマンドを Data 欄に貼り付ける（形式は「NFC Tools」が正書式です）</li>
            <li>Send を押してから、メダルを iPhone の上部にかざす。<strong>認証は1回のかざしの中だけ有効</strong>なので、コマンドは全部まとめて1回で送ってください</li>
            <li>終わったら Log の応答をコピーして、このページに貼り付けます。コピーできない場合は、NFC Tools のメモリ読み取りからダンプ（.bin）を書き出して STEP 2 で取り込んでください</li>
          </ol>
        </details>
        <details>
          <summary>無料で使える機能（2026-11-27 調査）</summary>
          <ul>
            <li><strong>無料</strong>: タグの読み取り（UID・情報表示）、メモリ読み取り、Advanced NFC Commands の送信（iOS での利用実例が複数あり、いずれも課金なしで全手順を紹介しています。ただし公式に「無料」と明記された文はありません）</li>
            <li><strong>未確認（任意機能）</strong>: ダンプの書き出し、お気に入りの登録・書き出し、Write Dump。これらは必須手順には使っていません。無料で使えたら便利な追加機能として案内しています</li>
            <li><strong>Pro Edition（¥600・買い切り）</strong>: iOS版で何が解放されるかは公式に公表されていません。このページの用途では購入する根拠はないため、不要です</li>
          </ul>
        </details>
      </section>

      <section className="card">
        <h2>Android: NFC Tools（Android版）で同じ手順</h2>
        <p className="note">
          Androidでも経路は同じです。このページが作るコマンドを、Android版 NFC Tools の Advanced NFC Commands で実行します
          （ブラウザの Web NFC は NDEF専用で、メダルの認証・生ページ読み書きには使えないためです）。
        </p>
        <details>
          <summary>Android版での使い方と無料範囲</summary>
          <ul>
            <li>Play ストアで NFC Tools（wakdev、無料）を入れる</li>
            <li>メニューから「Advanced NFC commands」を開き、I/O class は NfcA を選ぶ</li>
            <li>あとは iOS と同じです。Data 欄に貼り付け → 送信 → かざす → Log の応答をこのページに貼る</li>
            <li>無料範囲: Android版では Advanced Commands は通常機能として追加されており、Pro 限定の表記はありません（無料で使える公算が高いですが未確定）。Pro Edition は別アプリの買い切りで、この用途では不要です</li>
          </ul>
        </details>
      </section>

        <p className="note footer-note">
          注意: NFC Tools側の仕様（連続送信・認証維持・応答のコピー形式）は実機検証で確定させます。
          検証が済むまでは、書き込み系コマンドは無害テストから順に試してください。
        </p>
      </main>
    </>
  );
}
