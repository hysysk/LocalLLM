# Local LLM 環境構築

このリポジトリは、Ollama、Open WebUI、Open Terminal を連携させた Local LLM 環境構築のためのものです。

GPU (Apple Silicon の Metal) を利用するため、**Ollama はホスト上でネイティブに実行**します。Docker 版の Ollama では GPU が使えないため、コンテナとして起動するのは Open WebUI と Open Terminal のみで、これらはホスト上の Ollama へ `host.docker.internal` 経由で接続します。

## 構成

- **ollama:** ホスト上でネイティブに動作 (Docker 管理外)
  - macOS 版 Ollama アプリ (`/Applications/Ollama.app`) を使用
  - ポート: `11434` (既定で `127.0.0.1` を待ち受け)
  - モデルと設定は `~/.ollama` に保存
  - Metal による GPU アクセラレーションが有効
- **ui:** Open WebUI を動作させるコンテナ
  - `ghcr.io/open-webui/open-webui:latest` Docker イメージを使用
  - ポート: `${OPENWEBUI_PORT}:8080` (Open WebUI へのアクセス)
  - `OLLAMA_BASE_URL=http://host.docker.internal:11434` (ホストの Ollama を指定)
  - ボリューム: `openwebui:/app/backend/data` (会話履歴と設定を永続化)
- **open-terminal:** Open Terminal を動作させるコンテナ
  - `ghcr.io/open-webui/open-terminal:latest` Docker イメージを使用
  - ポート: `127.0.0.1:${OPEN_TERMINAL_PORT}:8000` (ローカルホストのみに公開)
  - `OPEN_TERMINAL_API_KEY` による Bearer 認証が必須
  - `OLLAMA_URL=http://host.docker.internal:11434/api/chat` (ホストの Ollama を指定)
  - ボリューム: `open-terminal:/home/user` (ホームディレクトリを永続化)
  - ボリューム: `./workspace:/home/user/workspace` (作業ディレクトリをホストと共有)

## 実行方法

1. Ollama をホストにインストールして起動します。

   [公式サイト](https://ollama.com/download) から macOS 版をダウンロードするか、Homebrew を使います。

   ```bash
   brew install --cask ollama
   ```

   アプリを起動するとバックグラウンドでサーバーが常駐します。起動確認は以下の通りです。

   ```bash
   curl -s http://localhost:11434/api/version
   ```

2. Ollama のモデルをダウンロードします。

   ```bash
   ollama pull gemma4:26b
   ollama pull qwen2.5vl:7b
   ```

3. `.env.sample` を `.env` にコピーして、環境変数を設定します。

   ```bash
   cp .env.sample .env
   ```

   `OPEN_TERMINAL_API_KEY` は必須です。未設定の場合は起動時にエラーになります。

   ```bash
   openssl rand -hex 32
   ```

4. `docker compose up -d` を実行してコンテナを起動します。

   ```bash
   docker compose up -d
   ```

5. 各サービスへアクセス:
   - Open WebUI: `http://localhost:${OPENWEBUI_PORT}`
   - Open Terminal API: `http://localhost:${OPEN_TERMINAL_PORT}`
   - Ollama API: `http://localhost:11434`

## Ollama の設定

ネイティブ実行の Ollama は環境変数で挙動を調整します。アプリから起動する場合は `launchctl setenv` で設定し、Ollama アプリを再起動します。

```bash
# モデルをメモリに保持する時間 (既定: 5m)
launchctl setenv OLLAMA_KEEP_ALIVE 5m
```

Docker Desktop for Mac では `host.docker.internal` 宛の通信がホストのループバックへ転送されるため、`127.0.0.1` を待ち受けたままでコンテナから接続できます。Docker Desktop 以外の環境で接続できない場合は `OLLAMA_HOST=0.0.0.0` を設定してください。

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

- `OPENWEBUI_PORT`: Open WebUI へのポート番号 (例: 3100)
- `OPEN_TERMINAL_PORT`: Open Terminal API へのポート番号 (例: 8000)
- `OPEN_TERMINAL_API_KEY`: Open Terminal の API キー (必須)

Ollama はホスト上でネイティブに動作し、コンテナ側は `http://host.docker.internal:11434` に固定して接続するため、`OLLAMA_BASE_URL` と `OLLAMA_PORT` は不要になりました。Ollama のポートを変更する場合は `docker-compose.yml` の `OLLAMA_BASE_URL` / `OLLAMA_URL` を直接書き換えます。

詳細は `.env` ファイルを参照してください。他のアプリケーションと競合しないようにポート番号を変更することがあります。

## 更新方法

Ollama はホスト側、Open WebUI と Open Terminal は Docker 側でそれぞれ更新します。

- Ollama: アプリの自動更新、または `brew upgrade --cask ollama`
- Open WebUI / Open Terminal:

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
- Docker Desktop (macOS) と Ollama がインストールされている必要があります。`host.docker.internal` に依存しているため、Linux の Docker Engine ではホスト側の設定が別途必要です。
- Ollama を起動していないとモデル一覧が空になります。コンテナを起動する前に Ollama が動作していることを確認してください。
- Open Terminal は任意のコマンドを実行できるため、ポートは `127.0.0.1` のみにバインドしています。外部に公開しないでください。
- `.env` は `.gitignore` で除外されています。API キーをコミットしないよう注意してください。
