# Local LLM 環境構築

このリポジトリは、Ollama と Open WebUI を連携させた Local LLM 環境構築のためのものです。

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

## 実行方法

1.  `docker-compose up -d` を実行してコンテナを起動します。
2.  Ollama のモデルをダウンロードします。
    ```bash
    docker exec -it ollama ollama pull gemma3:latest
    ```
3.  Open WebUI を `http://localhost:${OPENWEBUI_PORT}` にアクセスして利用します。

## 環境変数

- `OLLAMA_PORT`: Ollama API へのポート番号 (例: 11434)
- `OPENWEBUI_PORT`: Open WebUI へのポート番号 (例: 3000)
- `OLLAMA_BASE_URL`: Ollama の Base URL (例: http://host.docker.internal:11434)

## 注意事項

- この設定はあくまでサンプルです。 実際の環境に合わせて環境変数やポート番号を調整してください。
- Docker がインストールされている必要があります。
- env.sample を `.env` にコピーして、環境変数を設定してください。

```bash
cp env.sample .env
```
