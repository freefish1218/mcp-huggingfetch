# MCP HuggingFace 高速ダウンロードツール

⚡ 並行ダウンロード、レジューム対応、インテリジェント再試行機能付きの高速 HuggingFace モデルダウンロード - 従来の方法より 3-5 倍高速。Claude Desktop、Claude Code、Cursor、VS Code などのクライアントをサポート。

[English](README.md) | [中文版](README_zh.md) | [Français](README_fr.md) | [Deutsch](README_de.md)

## 📋 クイック設定

### Claude Desktop

`claude_desktop_config.json` に追加：

```json
{
  "mcpServers": {
    "huggingfetch": {
      "command": "npx",
      "args": ["-y", "mcp-huggingfetch@latest"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Claude Code

`.claude/claude_config.json` に追加：

```json
{
  "mcpServers": {
    "huggingfetch": {
      "command": "npx",
      "args": ["-y", "mcp-huggingfetch@latest"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Cursor / VS Code (Continue拡張機能)

`config.json` に追加：

```json
{
  "mcp": [
    {
      "name": "huggingfetch",
      "command": "npx",
      "args": ["-y", "mcp-huggingfetch@latest"],
      "env": {
        "HUGGINGFACE_TOKEN": "your_token_here"
      }
    }
  ]
}
```

## 🔑 HuggingFace トークンの取得

1. [HuggingFace Settings](https://huggingface.co/settings/tokens) にアクセス
2. 新しいアクセストークンを作成
3. 上記設定の `HUGGINGFACE_TOKEN` にトークンをコピー

## 🛠 使用方法

設定完了後、会話で以下の機能を直接使用：

### 📋 ファイル一覧表示

ダウンロード前にリポジトリのファイルを表示：

```
2Noise/ChatTTS リポジトリのすべてのファイルを一覧表示
```

```
bert-base-uncased リポジトリの JSON ファイルを表示
```

```
openai/whisper-large-v3 のファイルをサイズ順で表示
```

### 📥 モデルダウンロード

必要なファイルを選択的にダウンロード：

```
ChatTTS モデルを ./models ディレクトリにダウンロードしてください
```

```  
microsoft/DialoGPT-medium モデルをダウンロード、.bin ファイルのみ
```

```
openai/whisper-large-v3 モデルをダウンロード、テストファイルを除外
```

## 📝 サポート機能

### リストツールオプション (`list_huggingface_files`)

| パラメータ | タイプ | 説明 | 例 |
|-----------|------|------|-----|
| `repo_id` | string | HuggingFace リポジトリ ID | `"2Noise/ChatTTS"` |
| `revision` | string | Git ブランチ/タグ | `"main"`, `"v1.0"` |
| `path` | string | リポジトリサブパス | `"models/"` |
| `pattern` | string | ファイル名フィルターパターン | `"*.json"`, `"*.safetensors"` |
| `sort_by` | string | ソート方法 | `"size"`, `"name"`, `"type"` |

### ダウンロードツールオプション (`download_huggingface_model`)

| パラメータ | タイプ | 説明 | 例 |
|-----------|------|------|-----|
| `repo_id` | string | HuggingFace リポジトリ ID | `"2Noise/ChatTTS"` |
| `download_dir` | string | ダウンロードディレクトリ | `"./models"` |
| `files` | array | 特定ファイルリスト | `["model.bin", "config.json"]` |
| `allow_patterns` | string/array | 含めるパターン | `"*.json"` または `["*.pt", "*.bin"]` |
| `ignore_patterns` | string/array | 除外パターン | `"test_*"` または `["*.onnx", "test_*"]` |
| `revision` | string | Git ブランチ/タグ | `"main"`, `"v1.0"` |
| `force_redownload` | boolean | 強制再ダウンロード | `true`, `false` |

## 🔧 環境変数

| 変数 | 必須 | デフォルト | 説明 |
|------|------|-----------|------|
| `HUGGINGFACE_TOKEN` | ✅ | - | HuggingFace アクセストークン |
| `HUGGINGFETCH_DOWNLOAD_DIR` | ❌ | `~/Downloads/huggingface_models` | デフォルトダウンロードディレクトリ |
| `HF_HOME` | ❌ | `~/.cache/huggingface` | キャッシュディレクトリ |
| `LOG_LEVEL` | ❌ | `info` | ログレベル (`debug`, `info`, `warn`, `error`) |

## ❓ よくある質問

**Q: トークン認証に失敗した場合は？**  
A: `HUGGINGFACE_TOKEN` が正しく設定されているか確認し、トークンが有効で十分な権限があることを確認してください。

**Q: ダウンロード速度が遅い場合は？**  
A: ツールはレジュームダウンロードと並行ダウンロードをサポートしています。ネットワークの問題で速度が遅い場合は自動的に再試行されます。

**Q: プライベートモデルをダウンロードするには？**  
A: HuggingFace アカウントにアクセス権限があることを確認し、有効なトークンを使用してください。

**Q: どのファイル形式がサポートされていますか？**  
A: `.pt`、`.bin`、`.safetensors`、`.json`、`.txt` など、HuggingFace 上のすべてのファイル形式がサポートされています。

## 🏗 開発

### 前提条件

- Node.js 18+
- npm または yarn

### インストール

```bash
git clone https://github.com/freefish1218/mcp-huggingfetch.git
cd mcp-huggingfetch
npm install
```

### 開発コマンド

```bash
npm run dev          # ファイル監視モードで実行
npm start           # MCP サーバーを実行
npm run test:basic  # 基本機能テストを実行
npm test            # Jest 単体テストを実行
npm run lint        # コードスタイルをチェック
npm run lint:fix    # コードスタイル問題を自動修正
```

### ビルド

```bash
npm run build       # 単一バイナリをビルド
npm run build:all   # 全プラットフォーム用にビルド (Linux, macOS, Windows)
```

## 📄 ライセンス

MIT ライセンス - 詳細は [LICENSE](LICENSE) ファイルを参照。

## 📖 リンク

- GitHub: [freefish1218/mcp-huggingfetch](https://github.com/freefish1218/mcp-huggingfetch)
- Issues: [問題報告](https://github.com/freefish1218/mcp-huggingfetch/issues)
- NPM: [mcp-huggingfetch](https://www.npmjs.com/package/mcp-huggingfetch)

## 🤝 貢献

貢献歓迎！ガイドラインについては [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。