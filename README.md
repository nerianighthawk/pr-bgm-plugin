# BGM Finder

Premiere Pro用のUXPパネルです。ローカルの音源を登録し、曲ごとにタグを付けてAND検索できます。選んだ音源のプレビュー再生にも対応しています。

## 対応環境

- Adobe Premiere Pro 25.1以降（UXP対応環境）
- Adobe UXP Developer Tool（開発時のパネル読み込みに使用）

## 開発・起動

1. UXP Developer Toolでこのプロジェクトの`manifest.json`を読み込みます。
2. Premiere Proでパネル「BGM Finder」を開きます。
3. 「音源を追加」からMP3、WAV、M4A、AAC、AIFF、FLAC、OGGを選びます。
4. 音源ごとにタグを入力し、「タグを保存」を押します。
5. 検索欄に`明るい 日常 一軍`のように入力すると、すべてのタグを持つ曲だけが表示されます。

ライブラリ情報はプラグインのデータフォルダーに保存されます。元の音源ファイルはコピーしません。音源を移動した場合は、再度「音源を追加」から同じファイルを選択してください。

## テスト

```sh
node --test tests/library.test.js
python3 -m unittest tests/test_release_version.py
```

## GitHub Actionsでのビルド・リリース

`main`へのpush時にタグ検索テストを実行します。コミットメッセージの先頭が`[Major]`、`[Minor]`、`[Patch]`のいずれかの場合は、直近の安定版リリース（まだリリースがない場合は`manifest.json`のバージョン）を基準にSemVerを更新し、GitHub Releaseを作成します。

- `[Major]` 破壊的変更: メジャーを1増やし、マイナーとパッチを0にします。
- `[Minor]` 後方互換の機能追加: マイナーを1増やし、パッチを0にします。
- `[Patch]` 修正: パッチを1増やします。

リリースには、バージョンを反映したプラグイン一式の`.zip`と`.ccx`が添付されます。.zipは展開してUXP Developer Toolに読み込むためのプラグイン一式で、`.ccx`はCreative Cloud Desktop経由でインストールするパッケージです。CCXはAdobeの説明にあるZIP形式に従い、プラグインの`manifest.json`をルートにして作成します。
