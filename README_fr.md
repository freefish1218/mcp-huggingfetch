# Outil de Téléchargement Rapide MCP HuggingFace

[![npm version](https://badge.fury.io/js/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)
[![Tests](https://github.com/freefish1218/mcp-huggingfetch/actions/workflows/test.yml/badge.svg)](https://github.com/freefish1218/mcp-huggingfetch/actions/workflows/test.yml)
[![npm downloads](https://img.shields.io/npm/dm/mcp-huggingfetch.svg)](https://www.npmjs.com/package/mcp-huggingfetch)

⚡ Téléchargements haute vitesse de modèles HuggingFace avec téléchargement concurrent, reprise et nouvelle tentative intelligente - 3-5x plus rapide que les méthodes traditionnelles. Prend en charge Claude Desktop, Claude Code, Cursor, VS Code et autres clients.

<a href="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@freefish1218/mcp-huggingfetch/badge" alt="HuggingFetch MCP server" />
</a>

[English](README.md) | [中文版](README_zh.md) | [日本語](README_ja.md) | [Deutsch](README_de.md)

## 📋 Configuration Rapide

### Claude Desktop

Ajouter dans `claude_desktop_config.json` :

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

Ajouter dans `.claude/claude_config.json` :

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

### Cursor / VS Code (Extension Continue)

Ajouter dans `config.json` :

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

## 🔑 Obtenir un Token HuggingFace

1. Visitez [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Créez un nouveau token d'accès
3. Copiez le token dans `HUGGINGFACE_TOKEN` dans la configuration ci-dessus

## 🛠 Utilisation

Après configuration, utilisez directement les fonctionnalités suivantes dans les conversations :

### 📋 Lister les Fichiers

Voir les fichiers du dépôt avant téléchargement :

```
Lister tous les fichiers du dépôt 2Noise/ChatTTS
```

```
Afficher les fichiers JSON dans le dépôt bert-base-uncased
```

```
Afficher les fichiers dans openai/whisper-large-v3 triés par taille
```

### 📥 Télécharger des Modèles

Télécharger sélectivement les fichiers requis :

```
Veuillez télécharger le modèle ChatTTS dans le répertoire ./models
```

```  
Télécharger le modèle microsoft/DialoGPT-medium, uniquement les fichiers .bin
```

```
Télécharger le modèle openai/whisper-large-v3, exclure les fichiers de test
```

## 📝 Fonctionnalités Supportées

### Options de l'Outil de Liste (`list_huggingface_files`)

| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `repo_id` | string | ID du dépôt HuggingFace | `"2Noise/ChatTTS"` |
| `revision` | string | Branche/tag Git | `"main"`, `"v1.0"` |
| `path` | string | Sous-chemin du dépôt | `"models/"` |
| `pattern` | string | Motif de filtrage des noms de fichiers | `"*.json"`, `"*.safetensors"` |
| `sort_by` | string | Méthode de tri | `"size"`, `"name"`, `"type"` |

### Options de l'Outil de Téléchargement (`download_huggingface_model`)

| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `repo_id` | string | ID du dépôt HuggingFace | `"2Noise/ChatTTS"` |
| `download_dir` | string | Répertoire de téléchargement | `"./models"` |
| `files` | array | Liste de fichiers spécifiques | `["model.bin", "config.json"]` |
| `allow_patterns` | string/array | Motifs d'inclusion | `"*.json"` ou `["*.pt", "*.bin"]` |
| `ignore_patterns` | string/array | Motifs d'exclusion | `"test_*"` ou `["*.onnx", "test_*"]` |
| `revision` | string | Branche/tag Git | `"main"`, `"v1.0"` |
| `force_redownload` | boolean | Forcer le re-téléchargement | `true`, `false` |

## 🔧 Variables d'Environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| `HUGGINGFACE_TOKEN` | ✅ | - | Token d'accès HuggingFace |
| `HUGGINGFETCH_DOWNLOAD_DIR` | ❌ | `~/Downloads/huggingface_models` | Répertoire de téléchargement par défaut |
| `HF_HOME` | ❌ | `~/.cache/huggingface` | Répertoire de cache |
| `LOG_LEVEL` | ❌ | `info` | Niveau de log (`debug`, `info`, `warn`, `error`) |

## ❓ FAQ

**Q: L'authentification du token a échoué, que faire ?**  
R: Vérifiez que `HUGGINGFACE_TOKEN` est correctement défini, assurez-vous que le token est valide et possède les permissions suffisantes.

**Q: La vitesse de téléchargement est lente, que puis-je faire ?**  
R: L'outil prend en charge les téléchargements de reprise et concurrents. Les problèmes réseau peuvent causer des vitesses lentes, une nouvelle tentative automatique sera effectuée.

**Q: Comment télécharger des modèles privés ?**  
R: Assurez-vous que votre compte HuggingFace a les permissions d'accès et utilisez un token valide.

**Q: Quels formats de fichiers sont supportés ?**  
R: Tous les formats de fichiers sur HuggingFace sont supportés, incluant `.pt`, `.bin`, `.safetensors`, `.json`, `.txt`, etc.

## 🏗 Développement

### Prérequis

- Node.js 18+
- npm ou yarn

### Installation

```bash
git clone https://github.com/freefish1218/mcp-huggingfetch.git
cd mcp-huggingfetch
npm install
```

### Commandes de Développement

```bash
npm run dev          # Exécuter avec surveillance des fichiers
npm start           # Exécuter le serveur MCP
npm run test:basic  # Exécuter les tests de fonctionnalité de base
npm test            # Exécuter les tests unitaires Jest
npm run lint        # Vérifier le style de code
npm run lint:fix    # Corriger automatiquement les problèmes de style de code
```

### Build

```bash
npm run build       # Construire un binaire unique
npm run build:all   # Construire pour toutes les plateformes (Linux, macOS, Windows)
```

## 📄 Licence

Licence MIT - voir le fichier [LICENSE](LICENSE) pour les détails.

## 📖 Liens

- GitHub: [freefish1218/mcp-huggingfetch](https://github.com/freefish1218/mcp-huggingfetch)
- Issues: [Signaler des Problèmes](https://github.com/freefish1218/mcp-huggingfetch/issues)
- NPM: [mcp-huggingfetch](https://www.npmjs.com/package/mcp-huggingfetch)

## 🤝 Contribution

Les contributions sont bienvenues ! Veuillez consulter [CONTRIBUTING.md](CONTRIBUTING.md) pour les directives.