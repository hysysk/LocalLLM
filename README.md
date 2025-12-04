はい、Local LLMのためのGitリポジトリのREADMEテンプレートを作成します。以下に、提供されたdocker-composeファイルに基づいて作成したREADMEのサンプルを示します。

---

# Local LLM 環境構築

このリポジトリは、OllamaとOpen WebUIを連携させたLocal LLM環境構築のためのものです。

## Docker Compose

以下のdocker-compose.ymlファイルを使用します。

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "${OLLAMA_PORT}:11434"
    volumes:
      - ollama:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=24h
    restart: unless-stopped
  ui:
    image: ghcr.io/open-webui/open-webui:latest
    container_name: openwebui
    ports:
      - "${OPENWEBUI_PORT}:8080"
    environment:
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
    depends_on:
      - ollama
    restart: unless-stopped
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "${OLLAMA_PORT}:11434"
    volumes:
      - ollama:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=24h
    restart: unless-stopped
  ui:
    image: ghcr.io/open-webui/open-webui:latest
    container_name: openwebui
    ports:
      - "${OPENWEBUI_PORT}:8080"
    environment:
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
    depends_on:
      - ollama
    restart: unless-stopped
volumes:
  ollama:
```

## 構成

*   **ollama:** Ollama LLMを動作させるコンテナ
    *   `ollama/ollama:latest` Dockerイメージを使用
    *   ポート: `${OLLAMA_PORT}:11434` (Ollama APIへのアクセス)
    *   ボリューム: `ollama:/root/.ollama` (Ollamaの設定を永続化)
    *   `OLLAMA_KEEP_ALIVE=24h` (OllamaのKeep-Alive設定)
*   **ui:** Open WebUI を動作させるコンテナ
    *   `ghcr.io/open-webui/open-webui:latest` Dockerイメージを使用
    *   ポート: `${OPENWEBUI_PORT}:8080` (Open WebUIへのアクセス)
    *   `OLLAMA_BASE_URL=${OLLAMA_BASE_URL}` (OllamaのURLを指定)
    *   `depends_on: ollama` (Ollamaコンテナ起動後に起動)

## 実行方法

1.  `docker-compose up -d` を実行してコンテナを起動します。
2.  Ollamaのモデルをダウンロードします。
3.  Open WebUI を `http://localhost:${OPENWEBUI_PORT}` にアクセスして利用します。

## 環境変数

*   `OLLAMA_PORT`: Ollama APIへのポート番号 (例: 1234)
*   `OPENWEBUI_PORT`: Open WebUIへのポート番号 (例: 8080)
*   `OLLAMA_BASE_URL`: OllamaのBase URL (例: http://localhost:1234)

## 注意事項

*   この設定はあくまでサンプルです。 実際の環境に合わせて環境変数やポート番号を調整してください。
*   Dockerがインストールされている必要があります。
*   env.sampleを `.env` にコピーして、環境変数を設定してください。

```bash
cp env.sample .env
```

---

**備考:**

*   このREADMEはあくまでテンプレートです。  実際の利用状況に合わせて内容を充実させてください。
*   環境変数の定義や、具体的な設定方法、トラブルシューティングなどを追加すると、より役立つREADMEになります。
*   `OLLAMA_PORT` や `OPENWEBUI_PORT`  などの環境変数の定義方法も記載すると、よりユーザーフレンドリーになります。

このテンプレートを元に、あなたのLocal LLM環境構築リポジトリのREADMEを作成してください。