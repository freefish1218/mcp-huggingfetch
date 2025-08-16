# MCP HuggingFace Schnell-Download-Tool

[![npm version](https://badge.fury.io/js/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)
[![Tests](https://github.com/freefish1218/mcp-huggingfetch/actions/workflows/test.yml/badge.svg)](https://github.com/freefish1218/mcp-huggingfetch/actions/workflows/test.yml)
[![npm downloads](https://img.shields.io/npm/dm/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)

⚡ Hochgeschwindigkeits-HuggingFace-Modelldownloads mit gleichzeitigem Download, Fortsetzungsunterstützung und intelligentem Wiederholen - 3-5x schneller als herkömmliche Methoden. Unterstützt Claude Desktop, Claude Code, Cursor, VS Code und andere Clients.

<a href="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch/badge" alt="HuggingFetch MCP server" />
</a>

[English](README.md) | [中文版](README_zh.md) | [日本語](README_ja.md) | [Français](README_fr.md)

## 📋 Schnelle Einrichtung

### Claude Desktop

In `claude_desktop_config.json` hinzufügen:

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

In `.claude/claude_config.json` hinzufügen:

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

### Cursor / VS Code (Continue-Erweiterung)

In `config.json` hinzufügen:

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

## 🔑 HuggingFace Token erhalten

1. Besuchen Sie [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Erstellen Sie einen neuen Access Token
3. Kopieren Sie den Token in `HUGGINGFACE_TOKEN` in der obigen Konfiguration

## 🛠 Verwendung

Nach der Konfiguration verwenden Sie die folgenden Funktionen direkt in Gesprächen:

### 📋 Dateien auflisten

Repository-Dateien vor dem Download anzeigen:

```
Alle Dateien im 2Noise/ChatTTS Repository auflisten
```

```
JSON-Dateien im bert-base-uncased Repository anzeigen
```

```
Dateien in openai/whisper-large-v3 nach Größe sortiert anzeigen
```

### 📥 Modelle herunterladen

Erforderliche Dateien selektiv herunterladen:

```
Bitte laden Sie das ChatTTS-Modell in das ./models Verzeichnis herunter
```

```  
microsoft/DialoGPT-medium Modell herunterladen, nur .bin Dateien
```

```
openai/whisper-large-v3 Modell herunterladen, Testdateien ausschließen
```

## 📝 Unterstützte Funktionen

### Listen-Tool-Optionen (`list_huggingface_files`)

| Parameter | Typ | Beschreibung | Beispiel |
|-----------|-----|--------------|----------|
| `repo_id` | string | HuggingFace Repository-ID | `"2Noise/ChatTTS"` |
| `revision` | string | Git Branch/Tag | `"main"`, `"v1.0"` |
| `path` | string | Repository-Unterpfad | `"models/"` |
| `pattern` | string | Dateinamen-Filtermuster | `"*.json"`, `"*.safetensors"` |
| `sort_by` | string | Sortiermethode | `"size"`, `"name"`, `"type"` |

### Download-Tool-Optionen (`download_huggingface_model`)

| Parameter | Typ | Beschreibung | Beispiel |
|-----------|-----|--------------|----------|
| `repo_id` | string | HuggingFace Repository-ID | `"2Noise/ChatTTS"` |
| `download_dir` | string | Download-Verzeichnis | `"./models"` |
| `files` | array | Spezifische Dateiliste | `["model.bin", "config.json"]` |
| `allow_patterns` | string/array | Einschlussmuster | `"*.json"` oder `["*.pt", "*.bin"]` |
| `ignore_patterns` | string/array | Ausschlussmuster | `"test_*"` oder `["*.onnx", "test_*"]` |
| `revision` | string | Git Branch/Tag | `"main"`, `"v1.0"` |
| `force_redownload` | boolean | Erneuten Download erzwingen | `true`, `false` |

## 🔧 Umgebungsvariablen

| Variable | Erforderlich | Standard | Beschreibung |
|----------|--------------|----------|--------------|
| `HUGGINGFACE_TOKEN` | ✅ | - | HuggingFace Zugriffstoken |
| `HUGGINGFETCH_DOWNLOAD_DIR` | ❌ | `~/Downloads/huggingface_models` | Standard-Download-Verzeichnis |
| `HF_HOME` | ❌ | `~/.cache/huggingface` | Cache-Verzeichnis |
| `LOG_LEVEL` | ❌ | `info` | Log-Level (`debug`, `info`, `warn`, `error`) |

## ❓ FAQ

**F: Token-Authentifizierung fehlgeschlagen, was soll ich tun?**  
A: Überprüfen Sie, ob `HUGGINGFACE_TOKEN` korrekt gesetzt ist, stellen Sie sicher, dass der Token gültig ist und ausreichende Berechtigungen hat.

**F: Download-Geschwindigkeit ist langsam, was kann ich tun?**  
A: Das Tool unterstützt Fortsetzungsdownloads und gleichzeitige Downloads. Netzwerkprobleme können zu langsamen Geschwindigkeiten führen, automatische Wiederholung wird stattfinden.

**F: Wie kann ich private Modelle herunterladen?**  
A: Stellen Sie sicher, dass Ihr HuggingFace-Account Zugriffsberechtigungen hat und verwenden Sie einen gültigen Token.

**F: Welche Dateiformate werden unterstützt?**  
A: Alle Dateiformate auf HuggingFace werden unterstützt, einschließlich `.pt`, `.bin`, `.safetensors`, `.json`, `.txt`, usw.

## 🏗 Entwicklung

### Voraussetzungen

- Node.js 18+
- npm oder yarn

### Installation

```bash
git clone https://github.com/freefish1218/mcp-huggingfetch.git
cd mcp-huggingfetch
npm install
```

### Entwicklungsbefehle

```bash
npm run dev          # Mit Datei-Überwachung ausführen
npm start           # MCP Server ausführen
npm run test:basic  # Grundlegende Funktionstests ausführen
npm test            # Jest Unit-Tests ausführen
npm run lint        # Code-Stil prüfen
npm run lint:fix    # Code-Stil-Probleme automatisch beheben
```

### Build

```bash
npm run build       # Einzelne Binärdatei erstellen
npm run build:all   # Für alle Plattformen erstellen (Linux, macOS, Windows)
```

## 📄 Lizenz

MIT-Lizenz - siehe [LICENSE](LICENSE) Datei für Details.

## 📖 Links

- GitHub: [freefish1218/mcp-huggingfetch](https://github.com/freefish1218/mcp-huggingfetch)
- Issues: [Probleme melden](https://github.com/freefish1218/mcp-huggingfetch/issues)
- NPM: [mcp-huggingfetch](https://www.npmjs.com/package/mcp-huggingfetch)

## 🤝 Beitragen

Beiträge sind willkommen! Bitte siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Richtlinien.