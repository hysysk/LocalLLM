# Local LLM 環境構築

このリポジトリは、Ollama、Open WebUI、OpenClaw を連携させた Local LLM 環境構築のためのものです。

## 構成

- **ollama:** Ollama LLM を動作させるコンテナ
  - `ollama/ollama:latest` Docker イメージを使用
  - ポート: `${OLLAMA_PORT}:11434` (Ollama API へのアクセス)
  - ボリューム: `ollama:/root/.ollama` (Ollama の設定を永続化)
  - `OLLAMA_KEEP_ALIVE=24h` (Ollama の Keep-Alive 設定)
- **ui:** Open WebUI を動作させるコンテナ
  - `ghcr.io/open-webui/open-webui:latest` Docker イメージを使用
  - ポート: `${OPENWEBUI_PORT}:8080` (Open WebUI へのアクセス)
  - `OLLAMA_BASE_URL=${OLLAMA_BASE_URL}` (Ollama の URL を指定)
  - `depends_on: ollama` (Ollama コンテナ起動後に起動)
- **openclaw-gateway:** OpenClaw ゲートウェイを動作させるコンテナ
  - `ghcr.io/openclaw/openclaw:latest` Docker イメージを使用
  - ポート: `${OPENCLAW_GATEWAY_PORT}:18789` (OpenClaw ゲートウェイへのアクセス)
  - ポート: `${OPENCLAW_BRIDGE_PORT}:18790` (OpenClaw ブリッジポート)
  - パーソナルAIアシスタントとして機能
- **openclaw-cli:** OpenClaw CLI を動作させるコンテナ
  - `ghcr.io/openclaw/openclaw:latest` Docker イメージを使用
  - `depends_on: openclaw-gateway` (OpenClaw ゲートウェイ起動後に起動)

## 実行方法

1.  `docker-compose up -d` を実行してコンテナを起動します。
    ```bash
    docker-compose up -d
    ```

2.  Ollama のモデルをダウンロードします。
    ```bash
    docker exec -it ollama ollama pull gemma4:26b
    ```

3.  各サービスへアクセス:
    - Open WebUI: `http://localhost:${OPENWEBUI_PORT}` (デフォルト: http://localhost:3100)
    - OpenClaw ダッシュボード: `http://localhost:${OPENCLAW_GATEWAY_PORT}` (デフォルト: http://localhost:18789)

## OpenClaw の使用方法

OpenClaw は、WhatsApp、Telegram、Slack、Discord などのチャットアプリから利用できるパーソナルAIアシスタントです。

### 初期設定

1. OpenClaw ゲートウェイにアクセスして、初期設定を行います:
   ```bash
   # ダッシュボードを開く
   open http://localhost:18789
   ```

2. 設定ファイルの確認:
   ```bash
   # 設定ファイルを表示
   docker exec openclaw-gateway cat /home/node/.openclaw/openclaw.json
   ```

### OpenClaw と Ollama の連携

OpenClaw は Ollama の `gemma4:26b` モデルと連携しています。

**設定内容:**
- モデル: `ollama/gemma4:26b`
- Ollama URL: `http://ollama:11434` (Docker ネットワーク経由)
- 設定ファイル: `/home/node/.openclaw/openclaw.json`

**設定を確認:**
```bash
# 現在使用中のモデルを確認
docker-compose logs openclaw-gateway | grep "agent model"
# 出力例: [gateway] agent model: ollama/gemma4:26b
```

### チャットアプリとの連携

OpenClaw は以下のチャットアプリと連携できます:
- Telegram (ボットトークンが必要)
- WhatsApp
- Slack
- Discord
- その他多数

設定方法の詳細は [OpenClaw公式ドキュメント](https://docs.openclaw.ai/) を参照してください。

## 環境変数

- `OLLAMA_PORT`: Ollama API へのポート番号 (例: 11434)
- `OPENWEBUI_PORT`: Open WebUI へのポート番号 (例: 3100)
- `OLLAMA_BASE_URL`: Ollama の Base URL (例: http://host.docker.internal:11434)
- `OPENCLAW_GATEWAY_PORT`: OpenClaw ゲートウェイのポート番号 (デフォルト: 18789)
- `OPENCLAW_BRIDGE_PORT`: OpenClaw ブリッジのポート番号 (デフォルト: 18790)
- `OPENCLAW_GATEWAY_BIND`: バインドアドレス (lan, loopback, または 0.0.0.0)
- `OPENCLAW_TZ`: タイムゾーン (デフォルト: Asia/Tokyo)

詳細は `.env` ファイルを参照してください。

## 更新方法

Ollama、Open WebUI、OpenClaw のイメージを最新版に更新するには、以下の手順を実行します。

1. 最新のイメージをプルします。
   ```bash
   docker compose pull
   ```
2. コンテナを再作成して起動します。
   ```bash
   docker compose up -d --force-recreate
   ```
3. 古いイメージを削除します。
   ```bash
   docker image prune -f
   ```

## 注意事項

- この設定はあくまでサンプルです。 実際の環境に合わせて環境変数やポート番号を調整してください。
- Docker がインストールされている必要があります。
- env.sample を `.env` にコピーして、環境変数を設定してください。

```bash
cp env.sample .env
```
