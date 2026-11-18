# KasouLinux (`kasou_linux`)

ブラウザ上（WebAssembly）だけで動作する、サーバーレス・ブラウザ完結型の仮想Linuxターミナル環境です。

- **公開URL (GitHub Pages)**: https://issei-desu.github.io/kasou_linux/

## 主な特徴

- **ブラウザ完結＆安全**: すべてのコマンドやプログラムはアクセスした人のブラウザ内（WebAssembly + JavaScript）で実行されるため、サーバー負荷がゼロで安全に誰でも利用できます。
- **Linux 6.8 (v86) + 高速Wasmランタイム統合**:
  - 基本コマンド (`ls`, `cd`, `cat`, `grep`, `find`, `tree`, `mkdir`, `rm`, `cp`, `mv`, `chmod` 等)
  - ターミナル内エディタ (`nano <file>`, `vi <file>`) — `Ctrl+S` 保存、`Ctrl+R` 保存して即実行、`Esc` 自動保存して終了
  - **C言語 (`gcc`)**: `gcc hello.c -o hello && ./hello` （または `gcc hello.c && ./hello`）
  - **Python 3 (`python3`)**: `python3 hello.py` / `pip install <pkg>`
  - **Node.js (`node`)**: `node app.js`
  - **シェルスクリプト (`sh`)**: `sh sysinfo.sh`
  - **パッケージ導入 (`apt` / `sudo apt install`)**: `sudo apt install sl` → `sl`（蒸気機関車アニメーション）、`cowsay`、`fortune`、`figlet`、`cmatrix`、`htop`、`git`、`jq` など（`apt list` で一覧確認可能）
- **自動保存 (localStorage)**: 同じブラウザから開けば、作成・編集したファイルや導入パッケージ、コマンド履歴（`↑` キー）が自動的に引き継がれます。右上の「初期化」ボタン（または `reset` コマンド）でいつでも初期状態に戻せます。

## ローカルでの起動方法

```bash
python3 -m http.server 8080
```
ブラウザで `http://localhost:8080` を開きます。
