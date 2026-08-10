# Local LLM 環境構築

このリポジトリは、Ollama、Open WebUI、Open Terminal を連携させた Local LLM 環境構築のためのものです。

## 構成

- **ollama:** Ollama LLM を動作させるコンテナ
  - `ollama/ollama:latest` Docker イメージを使用
  - ポート: `${OLLAMA_PORT}:11434` (Ollama API へのアクセス)
  - ボリューム: `ollama:/root/.ollama` (モデルと設定を永続化)
  - `OLLAMA_KEEP_ALIVE=5m` (モデルをメモリに保持する時間)
- **ui:** Open WebUI を動作させるコンテナ
  - `ghcr.io/open-webui/open-webui:latest` Docker イメージを使用
  - ポート: `${OPENWEBUI_PORT}:8080` (Open WebUI へのアクセス)
  - `OLLAMA_BASE_URL=${OLLAMA_BASE_URL}` (Ollama の URL を指定)
  - ボリューム: `openwebui:/app/backend/data` (会話履歴と設定を永続化)
  - `depends_on: ollama` (Ollama コンテナ起動後に起動)
- **open-terminal:** Open Terminal を動作させるコンテナ
  - `ghcr.io/open-webui/open-terminal:latest` Docker イメージを使用
  - ポート: `127.0.0.1:${OPEN_TERMINAL_PORT}:8000` (ローカルホストのみに公開)
  - `OPEN_TERMINAL_API_KEY` による Bearer 認証が必須
  - ボリューム: `open-terminal:/home/user` (ホームディレクトリを永続化)
  - ボリューム: `./workspace:/home/user/workspace` (作業ディレクトリをホストと共有)

## 実行方法

1. `.env.sample` を `.env` にコピーして、環境変数を設定します。

   ```bash
   cp .env.sample .env
   ```

   `OPEN_TERMINAL_API_KEY` は必須です。未設定の場合は起動時にエラーになります。

   ```bash
   openssl rand -hex 32
   ```

2. `docker compose up -d` を実行してコンテナを起動します。

   ```bash
   docker compose up -d
   ```

3. Ollama のモデルをダウンロードします。

   ```bash
   docker exec -it ollama ollama pull gemma4:26b
   docker exec -it ollama ollama pull qwen2.5vl:7b
   ```

4. 各サービスへアクセス:
   - Open WebUI: `http://localhost:${OPENWEBUI_PORT}`
   - Open Terminal API: `http://localhost:${OPEN_TERMINAL_PORT}`

## Open Terminal の使用方法

Open Terminal は、LLM からファイル操作とコマンド実行を行うためのリモートターミナル API です。Open WebUI から接続することで、モデルがサンドボックス内でファイルを読み書きしたりコマンドを実行したりできるようになります。

### Open WebUI との連携

Open WebUI の管理者設定から Open Terminal を登録します。

- URL: `http://open-terminal:8000` (Docker ネットワーク経由)
- API キー: `.env` で設定した `OPEN_TERMINAL_API_KEY`

`docker compose` が作成する共通ネットワーク上にあるため、コンテナ名 `open-terminal` で名前解決できます。この URL のポートはコンテナ内部のポート (常に 8000) なので、`OPEN_TERMINAL_PORT` を変更しても変わりません。ホストから直接叩く場合は `http://localhost:${OPEN_TERMINAL_PORT}` を使います。

### API の確認

```bash
# API 仕様を表示
curl -s "http://localhost:${OPEN_TERMINAL_PORT}/openapi.json" | jq '.info'

# ディレクトリ一覧 (要 API キー)
curl -s -H "Authorization: Bearer ${OPEN_TERMINAL_API_KEY}" \
  "http://localhost:${OPEN_TERMINAL_PORT}/files/list?directory=workspace"
```

主なエンドポイント:

| エンドポイント | 説明 |
| --- | --- |
| `GET /files/list` | ディレクトリ一覧 |
| `GET /files/read` | ファイルの読み込み |
| `POST /files/write` | ファイルの書き込み |
| `POST /files/replace` | ファイル内容の置換 |
| `GET /files/grep` | ファイル内容の検索 |
| `GET /files/glob` | ファイル名の検索 |
| `POST /execute` | コマンドの実行 |
| `GET /execute/{process_id}/status` | 実行中コマンドの状態と出力 |
| `DELETE /execute/{process_id}` | 実行中コマンドの停止 |

### ワークスペース

`./workspace` がコンテナ内の `/home/user/workspace` にマウントされており、ホストとファイルを共有できます。ワークスペースの中身は `.gitignore` で除外されているため、個人のファイルはリポジトリにコミットされません (`workspace/tools/` 配下のスクリプトを除く)。

## 環境変数

- `OLLAMA_PORT`: Ollama API へのポート番号 (例: 11434)
- `OPENWEBUI_PORT`: Open WebUI へのポート番号 (例: 3100)
- `OLLAMA_BASE_URL`: Ollama の Base URL (例: http://host.docker.internal:11434)
- `OPEN_TERMINAL_PORT`: Open Terminal API へのポート番号 (例: 8000)
- `OPEN_TERMINAL_API_KEY`: Open Terminal の API キー (必須)

詳細は `.env` ファイルを参照してください。他のアプリケーションと競合しないようにポート番号を変更することがあります。

## 更新方法

Ollama、Open WebUI、Open Terminal のイメージを最新版に更新するには、以下の手順を実行します。

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

- この設定はあくまでサンプルです。実際の環境に合わせて環境変数やポート番号を調整してください。
- Docker がインストールされている必要があります。
- Open Terminal は任意のコマンドを実行できるため、ポートは `127.0.0.1` のみにバインドしています。外部に公開しないでください。
- `.env` は `.gitignore` で除外されています。API キーをコミットしないよう注意してください。
