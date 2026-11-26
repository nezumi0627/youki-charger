# NFC Tools（wakdev）「Advanced NFC Commands」仕様調査レポート

- 調査日: 2026-11-27
- 対象: NFC Tools for iOS（wakdev、App Store版。調査時点の最新は Version 3.6 / 2025-11-15 リリース、要 iOS 17.0以降）
- 目的: NTAG213（妖気メダル）に対して GET_VERSION(0x60) / PWD_AUTH(0x1B) / READ(0x30) / FAST READ(0x3A) / WRITE(0xA2) を、Webアプリ（妖気チャージWeb）が生成したコマンド列を NFC Tools に貼り付けて実行する構成が成立するか
- 凡例: [事実] = 出典で確認できたこと / [未確認] = 公開情報で確認できず実機検証が必要なこと。推測は書かない（推定が必要な箇所は「事例からの読み取り」と明記）

---

## 結論サマリー

- [事実] iOS版 NFC Tools に「Advanced NFC commands」は実在し（v2.16で追加）、NTAG213 への A2（WRITE）連続コマンドを iPhone から貼り付け実行する使い方が、第三者の iOS 向けガイドで具体的手順つきで公開されている（AnySpool の NTAG213 事例、後述）。生コマンド送信そのものは iOS でも使える。
- [事実] コマンドは **バイトごとにコロン区切り、複数コマンドはカンマ区切り** で1つの Data 欄に書くのが公式・事例共通の書式。1回の実行で複数コマンドを順に送れる。
- [事例あり・iOS単独は未確認] PWD_AUTH を先頭に置いたカンマ区切りチェーン（`1B:<PWD4バイト>,A2:...`）で認証後に WRITE する実例が NTAG213（Philips Sonicare ブラシヘッド）で公開されている。ただしその原典記事は実行プラットフォーム（iOS / Android）を明記していない。iOS 単独での PWD_AUTH→WRITE 成功の明示的記録は今回の調査では見つからなかった → **実機検証の最重要ポイント**。
- [未確認] お気に入りコマンドのインポート/エクスポートの**ファイル形式（拡張子・中身）は公開されていない**。形式が分かれば貼り付けを省ける可能性はあるが、現時点ではファイル生成の自動化は計画に入れられない。
- [未確認] 外部Web/アプリから URL スキーム等でコマンド実行を直接呼び出す方法は、公式・第三者いずれの資料でも**見つからなかった**。現行計画どおり「クリップボード経由の手動貼り付け」が前提。

---

## 1. 生コマンド（HEX）の入力書式

### [事実]
- 画面の場所: アプリ下部の「Other」→「Advanced NFC commands」。初回は免責の確認（"I assume" / "I Understand"）をタップする。画面には **I/O class（選択）、Data（入力欄）、Send、Log** がある（wakdev 公式ガイドのスクリーンショット説明より）。
- 出典: https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-use-advanced-nfc-commands.html
- 公式 Tips: **「カンマを使うと複数コマンドを送れる（例: `XX:XX:XX, XX:XX:XX`）」**。つまり書式は「1バイト = 2桁HEX を `:` でつなぐ」「コマンド間は `,`」が公式の正書式。
- iOS版リリースノートでも v2.21/2.22「Added comma separator on advanced NFC commands」と明記。
- 出典: 同上ガイド / https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- wakdev 公式ニュースレター（Android版 7.0 の説明だが書式は共通仕様として提示）: 例 `A2:04:FF:FF:FF:FF,30:04`（WRITE の後に READ を続けるチェーン）。
- 出典: https://www.wakdev.com/contents/newsletters/20190425.html
- iOS での実行手順の実例（AnySpool、NTAG213・iPhone）:
1. Data 欄をタップしてコマンド列を貼り付ける（Data 欄のプレースホルダ表示は `90 60...` のような例示）
2. Data 欄横の**虫眼鏡アイコン**をタップすると "Ready to Scan" ダイアログに**全コマンド（この事例では14個の A2）が一覧表示**される
3. タグを iPhone 上部にかざすと実行され、チェックマークで成功表示
- 出典: https://www.anyspool.de/how-to
- 別の iOS 向け実例（Yoto カード、Hack Club の教材）でも書式は同じで、実行ボタンは「Send Command」と表記されている（バージョンや画面差でボタン表記が違う可能性あり）:
- 例: `A2:03:E1:10:06:00,A2:04:03:04:D8:00,A2:05:00:00:FE:00`
- 出典: https://raei.me/blog/how-to-set-up-blank-nfc-cards-for-yoto/ / https://jams.hackclub.com/jam/hacker-card
- 日本語の実例（レコチョク技術ブログ、NTAG215 の保護設定）でも「その他 > 上級者向けNFCコマンド」に `A2:04:01:23:45:67` 形式（`A2:ページ:データ4バイト`、コロン区切り）で直接書き込む手順が紹介されている。
- 出典: https://techblog.recochoku.jp/12855
- 公開されているコマンド例はすべて **CRC を含まない**（`A2:...`、`30:04`、`1B:...` 等、コマンド+引数のみ）。事例からの読み取り: NFC Tools 側の送受信レイヤが CRC を処理する前提の書式になっている（公式に「CRC不要」と書かれた文は未確認）。

### [未確認]
- **コロンなし（`A204...`）やスペース区切り（`A2 04...`）の入力が iOS 版で受理されるか**。公式書式はコロン区切りで、確認できた実例はすべてコロン区切り。AnySpool が伝える Data 欄プレースホルダ `90 60...` はスペース区切りの例示に見えるが、それが受理書式の保証かは不明。→ Web側の生成は**コロン区切りで確定**してよい。
- 1回に送れるコマンド数の上限・Data 欄の文字数上限（14コマンドの iOS 実例はあり。それ以上は未確認）。
- 実行が途中のコマンドで失敗した場合、後続コマンドが止まるか続行するか（公式説明なし）。

### I/O Class について
- [事実] Advanced 画面には I/O Class の選択がある。NTAG213 / MIFARE Ultralight 系は **NfcA** を選ぶ（Android での NTAG5 事例では「デフォルトは NfcA、ISO15693 チップでは NfcV に変える」と説明。Sonicare の NTAG213 事例でも I/O Class = NfcA と明記）。
- 出典: https://www.iotsrg.org/blogs/nfc / https://www.judithvanstegeren.com/microblog/2023/
- [未確認] iOS版で I/O Class の選択肢が具体的に何（NfcA / Mifare 等の名称）で、デフォルトが何か。公式ガイドは「I/O class がある」としか説明していない。妖気メダルは従来のネイティブ実装でも iso14443 / MiFare で接続していたため、実機で該当クラスを選ぶ作業が発生する前提で手順書を作ること。

---

## 2. PWD_AUTH と認証状態の維持

### [事実]
- **Advanced Commands の画面自体に、認証パスワード専用の入力欄があるという公式説明はない。** 認証は「コマンド列の先頭に PWD_AUTH コマンド（`1B` + パスワード4バイト）を普通のコマンドとして含める」方式が実例のやり方。
- NTAG213 の実例（Philips Sonicare ブラシヘッド、パスワードは UID 等から生成）:
- Data: **`1B:67:B3:8B:98,A2:24:00:00:02:00`**（1B=PWD_AUTH、続く4バイトがパスワード、カンマの後に A2=WRITE）
- この1回の実行でタイマー領域への書き込み（＝認証が効いた状態での WRITE）が成功したと報告されている。つまり**カンマでつないだ同一実行内では認証状態が維持される**という実績。
- 出典: https://www.judithvanstegeren.com/microblog/2023/ （転載: https://nsaneforums.com/topic/447145-hacking-my-%E2%80%9Csmart%E2%80%9D-toothbrush-philips-sonicare/ ）
- 補足: この手順を iOS / Android 両対応として紹介し、パスワード生成→コマンドをコピー→NFC Tools に貼って送信、という本プロジェクトとほぼ同じフローを案内する記事もある（ただし著者がどちらの OS で実行したかは未記載）。
- 出典: https://sometimes.digital/posts/resetting-the-timer-in-my-toothbrush/
- 「4バイトHEXパスワード入力」の裏取り:
- [事実] iOS版 v2.38 リリースノート: **「Hex Password: new input mode for setting or removing a password using 4 raw bytes」**。これはタグの**パスワードを設定／削除する機能**（Set/Remove password）で使う入力モードであり、Advanced Commands の認証用入力欄ではない。
- パスワード設定／削除自体は以前からあり、v2.3「Protect your NFC tags with a password (only NTAG21x and Ultralight EV1)」、v3.5 ではタグ詳細から password 等の直接アクションが追加。
- 出典: https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- 参考（仕組みの一般論）: NTAG21x の PWD_AUTH は認証成功後「そのセッション中のみ」保護領域にアクセスでき、タグを離すとリセットされる（レコチョク技術ブログの NTAG215 解説）。→ 妖気チャージのフローは**1回の実行（1回のかざし）の中に PWD_AUTH→READ/WRITE 全部を入れる**設計にしなければならない。
- 出典: https://techblog.recochoku.jp/12855

### [未確認]
- **iOS版単独で `1B:...` を先頭にしたチェーンが成功した明示的記録**（上記 Sonicare 実例のプラットフォームが明記されていない）。CoreNFC 経由でも MiFare コマンド列として送る仕組みは AnySpool の iOS・A2 事例で裏付けられるが、PWD_AUTH の PACK 応答（`BE:EF` 等）の扱いも含め、**実機検証が必須**。
- パスワード保護されたタグに対して NFC Tools の通常の読み取り／書き込み機能が自動で認証プロンプトを出すか、出す場合どのパスワードを使うか（公式説明なし）。妖気メダルは AUTH0 の設定次第では読み取りにも認証が要るため、実機で確認すること。
- PWD_AUTH が失敗（PACK 不一致）した場合にチェーンが中断するか、エラー表示がどう出るか。

---

## 3. コマンド実行結果（レスポンス）の表示・コピー

### [事実]
- Advanced 画面には **Log** 表示がある（公式ガイドの画面説明: "I/O class, data, send and log"）。
- 出典: https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-use-advanced-nfc-commands.html
- iOS の AnySpool 事例では、実行時に "Ready to Scan" ダイアログに**送信コマンドの一覧**が表示され、成功時はチェックマークが出る（応答HEXの詳細表示まではガイドに記載なし）。
- 出典: https://www.anyspool.de/how-to
- Android版のガイドでは、Log に「送信コマンド → 応答HEX」が対で表示される例が示されている（例: `02:C1:...` → `00`、`02:C0:...` → `00:0B:00:00:00`、チップ検出や `Error: I/O failure` も Log に出る）。ただしこれは Android 版＋ISO15693 チップの事例で、iOS 版の Log 書式が同一かは未確認。
- 出典: https://www.iotsrg.org/blogs/nfc
- 検証手段として使える別の公式機能（iOS版リリースノートより）:
- メモリ読み取り／ダンプのエクスポート: v2.37「Export memory dumps as **.txt,.bin,.hex** or Flipper Zero compatible **.nfc** files」
- v2.38「Write Dump: write a raw binary dump (.bin) directly to a chip's memory」
- つまり書き込み結果の確認は「Read でメモリを読み直す／ダンプを.bin 等で書き出す」経路が公式に用意されている。
- 出典: https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html

### [未確認]
- **iOS版で Log の応答HEXをテキストとしてコピー／共有できるか**（長押しコピー、共有ボタン、ログ保存の有無）。公式・第三者とも記載が見つからなかった。
- 影響: 妖気チャージWeb へ READ 結果を戻す場合、現時点では「Log を目視して Web に手入力」か「ダンプ書き出しファイル（.txt/.bin/.hex）を Web に取り込む」設計しか確実とは言えない。後者はファイル形式が公開されている（上記）分だけ見通しが良い。
- iOS版 Log に応答がコマンド単位で全部表示されるか（特に READ 0x30 の16バイト応答、FAST READ の応答）。

---

## 4. お気に入り登録とインポート／エクスポート

### [事実]（すべて iOS版リリースノートより）
- v2.29: 「Now you can save your NFC commands」― コマンドの保存が可能に。定義済みコマンド一覧（pre-written commands、v2.24〜）も同梱。
- v3.1: 「Favorite Commands: New list editor to **add, reorder, and chain multiple NFC commands**」― お気に入りは複数コマンドを並べ替えて**チェーン（連結実行）**できるリスト形式。
- v3.2: 「**Favorite NFC Commands: Import and export your NFC commands**」― お気に入りコマンドのインポート／エクスポートに対応。
- 出典: https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html

### [未確認]
- **インポート／エクスポートのファイル形式（拡張子、中身が JSON / テキスト / 独自形式か）は一切公開されていない**（公式KB・リリースノート・第三者記事を調査したが記載なし）。
- → 「Web側でファイルを生成して NFC Tools に読み込ませ、貼り付けを省く」案は、**実機で一度エクスポートしてファイル実物を入手するまで実装不可**。実機検証フェーズで最初に確認すべき項目。
- お気に入りのチェーン実行が、Advanced 画面のカンマ区切り実行と完全に同じセッション挙動か（PWD_AUTH を含むチェーンをお気に入りから実行した場合の認証維持）。
- お気に入り登録やインポート／エクスポートが後述の Pro 課金の対象か（§6 参照）。

---

## 5. iOS版とAndroid版の機能差／ iOS で生コマンドが本当に使えるか

### [事実]
- **iOS で使えることの根拠**:
- wakdev 公式 iOS ページの機能一覧に「**Advanced commands: Send custom commands to NTAG, MIFARE and other chips**」と明記。対応チップとして NTAG 213 のテスト済み記載あり。要 iPhone XS/XR 以降・iOS 17（公式ページ表記。App Store 表記は iPhone 7 以降・iOS 17.0以降）。
- 出典: https://www.wakdev.com/en/apps/nfc-tools-ios.html / https://apps.apple.com/us/app/nfc-tools/id1252962749
- iOS版リリースノート: v2.16「Added advanced NFC commands」で iOS にも追加され、その後カンマ区切り（2.21/2.22）、コマンド保存（2.29）、お気に入りチェーン編集（3.1）、お気に入りのインポート／エクスポート（3.2）、Write Dump / Hex Password（2.38）と継続的に強化されている。
- 第三者の iOS 手順書（AnySpool）が、iPhone + NFC Tools で NTAG213 に A2 コマンド×14 を貼り付けて書き込む手順を写真つきで公開し、「所要約10秒」「チェックマークで成功」としている。
- **Android版との主な違い**（Advanced Commands の周辺）:
- Android版には「Tasks」タブ＋別アプリ NFC Tasks による自動化（200以上のタスク、条件ブロック、タグなし実行、NDEFエミュレーション等）がある。iOS版に Tasks 機能はなく、代わりにレコードの一種として「Shortcut レコード」（iOS ショートカットを起動するレコード）がある（v2.1/v2.16 のリリースノート）。
- 出典: https://www.wakdev.com/en/apps/nfc-tools-android.html / https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- 課金形態が違う: Android は無料版＋別アプリの買い切り「NFC Tools - Pro Edition」、iOS は単一アプリ＋アプリ内課金（§6）。
- 出典: https://www.wakdev.com/en/apps/other-apps/nfc-tools-pro-edition.html
- Advanced Commands の追加時期: Android の方が先行（Android Pro Edition の旧リリースノートに「Added advanced NFC commands」、2019年のニュースレターで複数コマンド送信を紹介）。iOS は v2.16 で追随。以後は iOS 側にもお気に入りチェーン等が入っている。
- I/O Class の名称（NfcA / NfcV 等）は本来 Android の NFC API のクラス名だが、公式ガイドの画面説明は Android / iOS 両方のスクリーンショットで同じ画面構成（I/O class, data, send, log）としている。

### [未確認]
- iOS版とAndroid版で、同じコマンド列の**応答の扱い・エラー時の挙動・チェーンの最大数**が同一か（比較資料なし）。
- iOS版の I/O Class の具体的な選択肢と、NTAG213 に対してユーザーが手動選択する必要があるか自動か。

---

## 6. 有料／無料の範囲

### [事実]
- App Store（米国）表記: 本体 **Free**、アプリ内課金あり「**NFC Tools - Pro Edition $3.99**」。日本ストアでの価格は今回未取得。
- 出典: https://apps.apple.com/us/app/nfc-tools/id1252962749
- AnySpool の iOS ガイドは NFC Tools を「**free** NFC Tools app」と呼び、その手順全体（Advanced Commands への貼り付け→書き込み）が無料前提で書かれている。Yoto / Hack Club のガイドも課金への言及なしに Advanced Commands を使っている。
- → **Advanced Commands の送信自体は無料で使える**と見てよい根拠がある。
- 出典: https://www.anyspool.de/how-to

### [未確認]
- iOS版の Pro Edition（$3.99 のアプリ内課金）が**具体的に何を解放するか**は、公式 iOS ページ・App Store 説明・リリースノートのいずれにも列挙が見つからなかった（「Enhanced In-App Purchases」等の曖昧な記載のみ、v2.30）。
- 特に「お気に入りのインポート／エクスポート」「Write Dump」「Hex Password」が無料範囲か Pro 必須かは未確認。実機の無料状態で各機能を触って確認する必要がある。
- Android の Pro Edition の特典一覧（プロファイル管理、既存タグからのインポート、ショートカット実行、エミュレーション、条件ブロック等）は Android 向けの説明であり、iOS の Pro 内課金にそのまま当てはまる保証はない。
- 出典: https://www.wakdev.com/en/apps/other-apps/nfc-tools-pro-edition.html

---

## 7. 外部アプリ／Webからの呼び出し（URLスキーム等）

### [事実]
- wakdev 公式サイト、公式KB、iOS版リリースノート、App Store 説明のいずれにも、**NFC Tools（iOS）を外部から開く URL スキーム、コマンドを渡して実行させるディープリンク、x-callback-url 等の記載は見つからなかった**（「URL」とあるのはタグに URL レコードを書く機能の説明のみ）。
- NFC Tools から「外向き」の連携はある: タグに書くレコードとして「Shortcut レコード」（読み取り時に iOS ショートカットを実行）や、アプリ起動・URL を開くレコードが用意されている。これは Web → NFC Tools の呼び出しとは逆方向。
- 出典: https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html（v2.1「Added a new record: Shortcut」、v2.16「optional input for Shortcut record」）

### [未確認]
- URL スキームが**未公開で存在する**可能性までは否定できない（未公開スキームの有無は外部から検証不能）。ただし公開情報ベースでは「外部Webからの直接実行」は**不可前提**で設計すべき。
- iOS ショートカットアプリ向けのアクション（App Intents）を NFC Tools が提供しているかも、公式資料では確認できなかった（ショートカット連携を明示しているのは競合の NFC.cool 等で、wakdev ではない）。

---

## 8. 対象コマンド別の見通し

| コマンド | 書式例（Data欄） | 根拠 | 状態 |
|---|---|---|---|
| GET_VERSION `0x60` | `60` | 汎用的な生コマンド送信の枠組みは確認済み。ただし NFC Tools で `60` 単体を送る具体例は資料に見つからず | **未確認**（実機で応答8バイトが Log に出るか確認） |
| PWD_AUTH `0x1B` | `1B:XX:XX:XX:XX` をチェーン先頭に | NTAG213 での `1B:...,A2:...` 成功実例あり（プラットフォーム明記なし） | **実例あり・iOS単独は未確認** |
| READ `0x30` | `30:04` | wakdev 公式ニュースレターのチェーン例に `30:04` を含む | 事実（書式）／ iOS の応答表示形式は未確認 |
| FAST READ `0x3A` | `3A:00:2C`（想定書式） | `3A` を NFC Tools で送った具体例は資料に見つからず | **未確認** |
| WRITE `0xA2` | `A2:06:XX:XX:XX:XX` | iOS・NTAG213 で14連 A2 の実例（AnySpool）、多数の事例 | **事実（iOS実例あり）** |

※ FAST READ は範囲指定で一括読みできる反面、応答が長くなる。Log の表示・コピーが未確認な現状では、読み取りは `30`（16バイト単位）で刻む方が、応答を目視確認しやすい可能性がある（設計上の検討事項であり、仕様の事実ではない）。

---

## 9. 未確認事項まとめ（実機検証チェックリスト）

優先度順。いずれも「妖気メダル実物 or 使い捨て NTAG213」で、iPhone 実機の NFC Tools（まず無料状態）で確認する。

1. [] `1B:<正しいPWD>,A2:...` のチェーンが iOS で成功するか（PACK 応答の表示、認証後の WRITE 成否）。誤った PWD ではどう失敗するか
2. [] `60`（GET_VERSION）の応答8バイトが Log にどう表示されるか。`3A`（FAST READ）の応答表示可否
3. [] Log のテキストをコピー／共有できるか。できない場合、検証フローは「ダンプ書き出し（.txt/.bin/.hex）→ Web取込」に倒す
4. [] お気に入りをエクスポートし、ファイルの拡張子と中身（テキストで読めるか）を確認 → Web側で同形式ファイルを生成できるか判断
5. [] 無料状態で使える機能の範囲（Advanced Commands、お気に入り登録／インポート／エクスポート、Write Dump、Hex Password）。Pro 課金が要る機能はどれか
6. [] I/O Class の選択肢と NTAG213 用の正しい選択。デフォルトのまま動くか
7. [] コロンなし／スペース区切り入力の可否（Web生成をコロン区切りに固定するなら検証不要だが、確認できれば生成側の自由度が上がる）
8. [] 1回に送れるコマンド数の実用上限（妖気チャージのフル書き込みは GET_VERSION+PWD_AUTH+READ多数+A2最大12回+再読 等、数十コマンド規模になり得る）
9. [] パスワード保護されたメダル（読み取りにも認証が要る設定）の場合、NFC Tools の Read／メモリ読み取りがどう振る舞うか
10. [] 途中のコマンドが失敗したときチェーンが止まるか／続くか、部分書き込みの検出方法

---

## 10. 出典一覧

公式（wakdev）:
- How to use advanced NFC commands?: https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-use-advanced-nfc-commands.html
- NFC Tools for iOS（機能一覧）: https://www.wakdev.com/en/apps/nfc-tools-ios.html
- NFC Tools for iOS - Release notes: https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- NFC Tools for Android: https://www.wakdev.com/en/apps/nfc-tools-android.html
- NFC Tools - Pro Edition（Android）: https://www.wakdev.com/en/apps/other-apps/nfc-tools-pro-edition.html
- ニュースレター（複数コマンド送信の例 `A2:04:FF:FF:FF:FF,30:04`）: https://www.wakdev.com/contents/newsletters/20190425.html
- How to protect your NFC tags?（パスワード保護の説明）: https://www.wakdev.com/en/knowledge-base/videos/how-to-protect-your-nfc-tags.html

ストア:
- App Store - NFC Tools（価格・IAP・対応機種）: https://apps.apple.com/us/app/nfc-tools/id1252962749

第三者の実例・ガイド:
- AnySpool（iOS + NTAG213、A2×14 の貼り付け書き込み手順）: https://www.anyspool.de/how-to
- Yoto カード設定（Advanced Commands に A2 チェーンを貼る手順）: https://raei.me/blog/how-to-set-up-blank-nfc-cards-for-yoto/
- Hack Club - Hacker Card（同上の初期化コマンド）: https://jams.hackclub.com/jam/hacker-card
- Sonicare ブラシヘッドの PWD_AUTH 実例（原典）: https://www.judithvanstegeren.com/microblog/2023/
- 同実例の iOS/Android 手順紹介: https://sometimes.digital/posts/resetting-the-timer-in-my-toothbrush/
- Black Hat India 2026 Badge NFC Guide（Android の Log 表示例）: https://www.iotsrg.org/blogs/nfc
- レコチョク技術ブログ（NTAG215 保護設定、NFC Tools の上級者向けNFCコマンド手順、PWD_AUTH のセッション性）: https://techblog.recochoku.jp/12855

※ 調査方法: 上記は 2026-11-27 に Web 検索・ページ取得で確認した内容。wakdev 公式KBに Advanced Commands の詳細仕様ページは上記の How-to 1件のみで、書式の細部（区切り文字の許容範囲、ログのコピー可否、インポート形式）は公式には公開されていない。
