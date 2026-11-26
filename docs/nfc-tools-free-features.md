# NFC Tools（wakdev）無料で使える機能 調査レポート

- 調査日: 2026-11-27
- 対象: NFC Tools for iOS（App Store版、最新 v3.6 / iOS 17.0以降）および Android版
- 目的: 自作Webアプリのガイドページに「無料範囲でどこまでできるか」を正確に書くための裏取り
- 前提: 機能仕様そのものは先行レポート `nfc-tools-spec.md` を参照。本レポートは**料金・無料可否に特化**し、先行調査で未確認だった項目を埋める
- 凡例: **無料** / **Pro必須** / **未確認** の3判定。根拠の強さ（公式明記／公式資料の沈黙／第三者実例）も併記する。推測で「無料」と断定しない

---

## 判定表（iOS版）

| # | 機能 | 判定 | 根拠の強さ |
|---|---|---|---|
| 1 | Advanced NFC Commands の送信 | **無料** | 第三者実例（複数）＋公式資料に Pro 限定表記なし |
| 2a | タグ読み取り（UID・タイプ・NDEF等の表示） | **無料** | 公式の基本機能として明記 |
| 2b | メモリ読み取り（Read / Edit memory） | **無料** | 公式ページ・リリースノートに通常機能として掲載 |
| 2c | メモリダンプ書き出し（.txt / .bin / .hex / .nfc） | **未確認** | Pro 限定の根拠も、無料実例の明示もなし |
| 3a | お気に入り（Favorite Commands）登録・保存 | **未確認** | リリースノートに Pro 表記なし。無料実例の明示なし |
| 3b | お気に入りのチェーン実行（連結実行） | **未確認** | 同上。ただし素のカンマ区切り連結実行は #1 の無料経路で代替可能 |
| 3c | お気に入りのインポート / エクスポート | **未確認** | 同上。ファイル形式自体も未公開（先行レポート参照） |
| 4 | Write Dump（.bin の直接書き込み） | **未確認** | リリースノートに Pro 表記なし。無料実例の明示なし |
| 5 | Pro Edition の価格（日本） | **¥600・買い切り型**（サブスクではない） | 日本 App Store 掲載で確定（後述） |

---

## 1. Advanced NFC Commands の送信 — 判定: 無料

- [実例] iOS + NTAG213 で A2 コマンド×14 を貼り付け書き込みする手順を公開した AnySpool のガイドは、NFC Tools を「**free** NFC Tools app」と呼び、手順のどこにも課金・Pro への言及がない。
  - https://www.anyspool.de/how-to
- [実例] Hack Club の教材・Yoto カード設定ガイドも、iOS の Advanced NFC Commands を使う手順を課金に触れずに案内している。
  - https://jams.hackclub.com/jam/hacker-card / https://raei.me/blog/how-to-set-up-blank-nfc-cards-for-yoto/
- [実例] レコチョク技術ブログ（日本語）も、iPhone の NFC Tools「その他 > 上級者向けNFCコマンド」で NTAG215 に直接書き込む手順を、課金の話なしに紹介している。
  - https://techblog.recochoku.jp/12855
- [公式] wakdev 公式の使い方ガイドは Advanced Commands の操作だけを説明し、利用条件として課金を挙げていない。
  - https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-use-advanced-nfc-commands.html
- [公式] iOS版リリースノート v2.16「Added advanced NFC commands」にも Pro 限定の表記はない（リリースノート全編を通じ、どの機能にも Pro 限定表記はない。§「Pro が解放する機能」参照）。
  - https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- 注意: wakdev 公式が「Advanced Commands は無料」と**明記した文章は存在しない**。上記は「複数の独立した実例が無料前提で成立している」ことからの判定であり、最終確定は実機の無料状態での確認になる。

## 2. 読み取り・ダンプ書き出し

### 2a. タグ読み取り（UID表示・タグ情報） — 判定: 無料
- [公式] 日本 App Store の説明文で「読み取り」セクションの中心機能として掲載（メーカー、タイプ、シリアル番号、サイズ、NDEFデータ等）。アプリ本体は無料。
  - https://apps.apple.com/jp/app/nfc-tools/id1252962749
- [第三者] AppMatch の無料/プロ版比較表でも、無料版の範囲に「タグの読み取り、タグ情報（メーカー・タイプ・NDEF内容）の確認」が入っている。
  - https://appmatch.jp/1252962749-2/

### 2b. メモリ読み取り（Read / Edit memory） — 判定: 無料
- [公式] wakdev 公式 iOS ページのスクリーンショット・機能説明に「Tag memory（各ページのアドレス・内容・アクセス条件）」が通常機能として掲載され、Pro の区別はない。
  - https://www.wakdev.com/en/apps/nfc-tools-ios.html
- [公式] リリースノートでも v2.9「Edit your NFC chip memory」、v2.17「Read, edit, format memory」、v3.5「タグ詳細から memory 等への直接アクション」と、通常の機能追加として告知され続けている。
  - https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html

### 2c. メモリダンプ書き出し（.txt / .bin / .hex / .nfc） — 判定: 未確認
- [公式] 機能の存在は確定: v2.37「Export memory dumps as .txt, .bin, .hex or Flipper Zero compatible .nfc files」、v3.0「Integrated memory dumps into tag profiles」。
- [公式] wakdev 公式 iOS ページの機能一覧にも「**Dump & export tag memory**: Read the full memory content of your NFC tags and export it.」と Pro 区別なく掲載されている。
  - https://www.wakdev.com/en/apps/nfc-tools-ios.html
- ただし、無料状態で実際に書き出しまで行った第三者実例の明示は今回の調査で見つからなかった。Pro 必須とする根拠もないため **未確認** とし、実機の無料状態で確認する。

## 3. お気に入り（Favorite Commands） — 判定: いずれも未確認

- [公式] 機能の存在と追加時期は確定（すべて iOS版リリースノート）:
  - v2.29「Now you can save your NFC commands」（保存）
  - v3.1「Favorite Commands: New list editor to add, reorder, and chain multiple NFC commands」（チェーン実行）
  - v3.2「Favorite NFC Commands: Import and export your NFC commands」（インポート/エクスポート）
  - https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- いずれの告知にも Pro 限定の表記はないが、無料状態で使った実例の明示も見つからなかったため、登録・チェーン実行・インポート/エクスポートとも **未確認**。
- 実務上の補足: チェーン実行については、お気に入りを経由しなくても Advanced Commands の Data 欄にカンマ区切りで書く方法（#1、無料）が同等の連結実行になる。お気に入りは「保存して再利用する」用途でのみ必要。

## 4. Write Dump（.bin書き込み） — 判定: 未確認

- [公式] 機能の存在は確定: iOS版 v2.38「Write Dump: write a raw binary dump (.bin) directly to a chip's memory」。
  - https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- [公式] wakdev 公式 SNS の iOS v3.5 紹介画像でも、「Other」メニューの項目一覧（Erase tag / Copy tag / … / Advanced NFC commands / **Write dump (.bin)**）の1つとして画面に表示されている。
  - https://www.facebook.com/nfc.tools/posts/pfbid035DPxabZwhyNWB3Xum7NGVFQqYRHYmP96Y21Wc9NgZdKpKi7UinzVbT6fsan8iKSjl
- Pro 限定の表記・根拠はないが、無料状態での使用実例の明示もないため **未確認**。

## 5. Pro Edition の価格（日本） — ¥600、買い切り型

- [公式ストア・確定] 日本の App Store の「アプリ内購入」欄に掲載されているのは1件のみ:
  - **NFC Tools - Pro Edition ¥600**
  - アプリ本体は無料。自動更新サブスクリプションの掲載はなく、月額/年額プランは存在しない → **買い切り型（1回払いの非消耗型アプリ内課金）**。
  - https://apps.apple.com/jp/app/nfc-tools/id1252962749 （2026-11-27 取得）
- [参考] 米国 App Store では同じ IAP が **$3.99**。
  - https://apps.apple.com/us/app/nfc-tools/id1252962749
- [第三者] AppMatch も iOS のプロ版を「買い切り」「一度きりの支払いでプロ版が有効になる」と説明している。
  - https://appmatch.jp/1252962749-2/
- [参考] 過去の日本のユーザーレビューには「400円」の言及があり、以前は ¥400 で現在 ¥600 に改定されたとみられる（ガイドには現行の ¥600 を書くこと）。

## 6. iOS版 Pro Edition が解放する機能 — 公式には公表されていない

**結論: wakdev は iOS版 Pro Edition（¥600 の IAP）が何を解放するかを、公式ページ・App Store 説明・リリースノートのどこにも列挙していない。**

- 公式 iOS ページの機能一覧（Read / Dump & export / Copy & clone / Erase, format & protect / Advanced commands 等）には Pro の区別が一切ない。
  - https://www.wakdev.com/en/apps/nfc-tools-ios.html
- iOS版リリースノート全編（v1.x〜v3.6）で課金に触れるのは v2.30「Enhanced In-App Purchases and restore process」のみで、対象機能の指定はない。
  - https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- [第三者・要割り引き] AppMatch の比較表は iOS のプロ版の内容として「Wi-Fi設定やBluetooth構成の書き込み、複数データのまとめ書き込み」を挙げている。しかし wakdev 公式 iOS ページと App Store 説明は、Wi-Fi/Bluetooth レコードや複数レコード書き込みを通常機能として紹介しており、内容が矛盾する。AppMatch の表は編集部作成の「目安」と自称しており、根拠としては弱い。
  - https://appmatch.jp/1252962749-2/ vs https://apps.apple.com/jp/app/nfc-tools/id1252962749
- [ユーザーの声] 日本の App Store レビューのまとめには「無料で出来ることと課金して出来ること何ら変わりませんでした」「プロ版を購入したのにプロ版の機能が有効にならない」といった声が引用されており、購入者側にも解放内容が見えていない様子がうかがえる（逸話レベル）。
  - https://appmatch.jp/1252962749-4/
- [混同注意] Android版 Pro Edition の特典一覧（プロファイル管理、既存タグからインポート、タグなしタスク実行、NDEFエミュレーション、条件ブロック、200以上のタスク）は **iOS の IAP の内容ではない**。そもそも「タスク」「エミュレーション」は iOS版に機能自体が存在しない。比較サイト等がこの一覧を iOS にも当てはめて書いている例があるので、ガイドに転用しないこと。
  - https://play.google.com/store/apps/details?id=com.wakdev.nfctools.pro&hl=ja

## 7. Android版との違い

### 課金モデル
| | iOS | Android |
|---|---|---|
| 本体 | 無料アプリ＋アプリ内課金1件 | 無料アプリ＋**別アプリ**「NFC Tools - Pro Edition」 |
| Pro の価格 | ¥600（日本）/ $3.99（米国）、買い切り型 IAP | $3.99、買い切りの有料アプリ（Galaxy Store では $3.49 表記もあり、ストア/地域で異なる） |
| Pro の中身の公表 | **なし**（§6） | あり（下記） |
| タスク実行 | iOS版にタスク機能なし | 実行には無料の別アプリ「NFC Tasks」が別途必要 |

### Android版 Pro Edition が解放するもの（公式 Play ストア説明）
- プロファイル管理システム（レコードとタスクの保存・再利用）
- 既存の NFC タグからインポートして編集
- ホーム画面ショートカットで、タグなしでタスクを実行
- デバイスで NDEF タグをエミュレート
- 条件分岐（IF）ブロック
- 200パターン以上のタスクすべてへの無制限アクセス
- 説明文冒頭は「NFC Tools - Pro Edition は、制限が解除され、NFC Toolsアプリのすべての機能が使えます」
- 出典: https://play.google.com/store/apps/details?id=com.wakdev.nfctools.pro&hl=ja / https://galaxystore.samsung.com/detail/com.wakdev.nfctools.pro

### Android無料版での Advanced Commands 等 — 無料版側の機能として告知されている
- [公式] Android版リリースノートには、Advanced Commands の存在が古くから通常の機能追加として載っている:
  - v6.3「Set counter status for NTAG21X in advanced commands」
  - v7.0「Now you can send multiple commands in advanced commands, separate with comma character」
  - https://www.wakdev.com/en/apps/nfc-tools-android/release-notes.html
- 同じノートには、お気に入り保存（v8.11）、メモリ書き出し .txt/.bin/.hex/.nfc（v9.3）、Write Dump（v9.4）、お気に入りリスト編集・チェーン（v9.6）、お気に入りのインポート/エクスポート（v9.7）も並んでいる。
- 注意（判定の留保）: このリリースノートは無料版と Pro 版で共通の版番号（現行どちらも 9.8）の変更履歴であり、Pro 限定項目には v6.1.1 のように「**(pro only)**」と明記される慣例がある。上記の各項目にその表記はないため「無料版でも使える公算が高い」とは言えるが、ノート単体では無料版での動作保証にはならない。Android ではこの点も実機確認が確実。

### その他の構造的な違い（先行レポートの再掲）
- Android版には「Tasks」タブ＋ NFC Tasks 連携の自動化がある。iOS版にタスク機能はなく、代わりに「Shortcut レコード」（タグ読み取りで iOS ショートカットを起動）がある。
- Advanced Commands の追加は Android が先行し、iOS は v2.16 で追随した。

---

## ガイドページへの反映方針（まとめ）

- **必須経路は Advanced Commands の送信のみ**で、これは無料と判定できる（実例ベース）。ガイドの本文はこの前提で書いてよい。ただし「公式に無料と明記されているわけではない」点は脚注に残すのが正確。
- **お気に入り登録/チェーン/インポート・エクスポート、ダンプ書き出し、Write Dump は無料可否が未確認**。ガイドでは必須手順に入れず、「無料で使えたら便利な任意機能」として書き、実機の無料状態で確認できたら格上げする。
- Pro に触れる場合は「**Pro Edition ¥600（買い切り）。ただし iOS版で何が解放されるかは公式に公表されていない**」と書くのが正確。Android版 Pro の特典一覧を iOS の説明に流用しない。
- 妖気チャージの用途では、現時点で Pro の購入を推奨する根拠はない（必須機能が無料経路にあるため）。

## 出典一覧

公式（wakdev）:
- NFC Tools for iOS（機能一覧）: https://www.wakdev.com/en/apps/nfc-tools-ios.html
- NFC Tools for iOS - Release notes: https://www.wakdev.com/en/apps/nfc-tools-ios/release-notes.html
- NFC Tools for Android - Release notes: https://www.wakdev.com/en/apps/nfc-tools-android/release-notes.html
- How to use advanced NFC commands?: https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-use-advanced-nfc-commands.html
- 公式SNS（iOS v3.5 の「Other」メニュー画面）: https://www.facebook.com/nfc.tools/posts/pfbid035DPxabZwhyNWB3Xum7NGVFQqYRHYmP96Y21Wc9NgZdKpKi7UinzVbT6fsan8iKSjl

ストア:
- App Store 日本（IAP ¥600）: https://apps.apple.com/jp/app/nfc-tools/id1252962749
- App Store 米国（IAP $3.99）: https://apps.apple.com/us/app/nfc-tools/id1252962749
- Google Play - NFC Tools（無料版）: https://play.google.com/store/apps/details?id=com.wakdev.wdnfc&hl=ja
- Google Play - NFC Tools - Pro Edition: https://play.google.com/store/apps/details?id=com.wakdev.nfctools.pro&hl=ja
- Galaxy Store - NFC Tools - Pro Edition: https://galaxystore.samsung.com/detail/com.wakdev.nfctools.pro

第三者:
- AppMatch「NFC Toolsの使い方と評価｜無料版と有料版の違いを整理」: https://appmatch.jp/1252962749-2/
- AppMatch「NFC Toolsの評判は？」（レビューまとめ）: https://appmatch.jp/1252962749-4/
- AnySpool（iOS + NTAG213 の Advanced Commands 手順）: https://www.anyspool.de/how-to
- Hack Club - Hacker Card: https://jams.hackclub.com/jam/hacker-card
- レコチョク技術ブログ: https://techblog.recochoku.jp/12855
- NFC Memo 比較記事（価格表記は Google Play 基準）: https://www.nfcmemo.com/blog/nfc-tools-vs-nfc-cool-vs-nfc-memo

※ 調査方法: 2026-11-27 に Web 検索・ページ取得で確認。wakdev 公式は iOS 版 Pro の解放機能を公表していないため、iOS の個別機能の無料可否は「公式の Pro 限定表記の有無」と「第三者実例の有無」で判定し、どちらも欠けるものは未確認とした。未確認項目の最終判定は、実機（無料状態）での確認による。
