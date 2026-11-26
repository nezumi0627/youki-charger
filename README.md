# 妖気チャージ

妖怪ウォッチの「妖気メダル」（NTAG213 / MIFARE Ultralight）を読み書きするツール。
プラットフォームごとにNFCの経路が違うだけで、解析・暗号・記録操作のコア仕様は共通です。

**Web版（GitHub Pages）**: https://nezumi0627.github.io/youki-charger/

| プラットフォーム | NFCの経路 |
| --- | --- |
| Android | 専用アプリ（このリポジトリの `android/`）が直接NFC通信する |
| iOS | Web版がコマンドを生成し、**NFC Tools**（Advanced NFC Commands）で実行する手動経路 |
| PC等 | Web版でダンプ（.bin）の解析・バックアップ管理ができる |

## Web版（`src/`、ルート）

React + TypeScript + Vite の静的Webアプリ（PWA）。全処理がブラウザ内で完結し、データは外部送信されません。

- iOS: UID入力 → 読込コマンド生成 → NFC Toolsで実行 → 応答を貼って解析 → 書込コマンド生成 → 照合までを画面の STEP 1〜4 で案内します。NFC Tools の無料範囲と使い方はアプリ内のガイドにまとめています
- ダンプ（180バイト `.bin`、Android版と共通形式）の取り込み・書き出し、破損診断・修復・作り直しにも対応

```bash
bun install
bun run dev      # 開発サーバー
bun run test     # コアロジックのテスト（実メダルの公開ダンプ等のベクトルで照合）
bun run build    # 型チェック + 本番ビルド（dist/）
```

デプロイは `.github/workflows/pages.yml`（main への push で GitHub Pages へ自動デプロイ）。

## Android版（`android/`）

Kotlin のネイティブアプリ。`MifareUltralight.transceive` で直接通信します。

- 読み取り（妖気・回数・破損診断）、チャージ、回数リセット、修復、作り直し、バックアップ復元
- 書き込み安全策: 書込み前の内部バックアップ自動保存、前回読み取りとの照合、ページごとの読み戻し確認、最終確認
- ビルドは `.github/workflows/android.yml`（GitHub Actions）。ベータ版APKは Releases に添付されます

## コア仕様（全プラットフォーム共通）

- 鍵導出: HMAC-SHA256 ×2（ニブルS-box変換を挟む）、パスワードは導出結果の下位4バイト
- 暗号: AES-128-CTR（big-endianカウンタ、パディングなし）
- 記録: 48バイト平文 = メタデータ16 + 妖気レコード16×2（履歴ビットマップ、ID、飽和カウンタ、チェックサム）
- 認証は1セッションにつき PWD_AUTH 1回だけ。書き込みは記録ページ優先の順序で、ロック済みページは対象外

## クレジット

- iOS版のオリジナル実装（SwiftUI + CoreNFC）は ゆう（Yu08083）の `youki-charger-ios`。本リポジトリは本人の了承を得て、iOS版・Web版・Android版を1つに統合したものです
- メダルのデータ形式・暗号仕様は Flipper Zero 向けプロジェクト等の公開情報を土台にしています

## 注意

- iOS経路（NFC Tools の Advanced NFC Commands で PWD_AUTH を含むチェーンが成立するか）は実機検証中です（`FIELD-TEST.md`）
- 対応ゲーム: 妖怪ウォッチ3 / バスターズ2
