/**
 * KasouLinux Shared Virtual File System (VFS)
 * Bridges Hybrid Shell, Wasm Language Runtimes (Pyodide, C, Node),
 * in-terminal editor (vi/nano), and v86 Linux 9p (/mnt).
 */

(function (global) {
  "use strict";

  const DB_NAME = "KasouLinuxDB";
  const DB_VERSION = 1;
  const STORE_VFS = "vfs_state";
  const STORE_VM = "vm_snapshot";

  const DEFAULT_FILES = {
    "/mnt/README.txt": {
      type: "file",
      mode: "0644",
      mtime: Date.now(),
      content: [
        "==============================================================",
        "  KasouLinux - ブラウザ完結型 仮想Linuxターミナル環境",
        "==============================================================",
        "",
        "この環境はサーバー通信を必要とせず、ブラウザ内の WebAssembly",
        "(v86 Linux 6.8 カーネル + 高速Wasmランタイム) で動作します。",
        "GitHub Pages でもそのまま静的サイトとして公開可能です。",
        "",
        "【主なコマンド】",
        "  ls -la              : ファイル一覧の表示",
        "  cat README.txt      : ファイル内容の表示",
        "  vi hello.py         : ターミナル内エディタでファイルを編集",
        "  python3 hello.py    : Python 3 プログラムの実行",
        "  gcc hello.c -o hello && ./hello : C言語のコンパイルと実行",
        "  node app.js         : Node.js プログラムの実行",
        "  sh sysinfo.sh       : シェルスクリプトの実行",
        "  pip install <pkg>   : Python パッケージの導入 (Pyodide)",
        "  apk add <pkg>       : パッケージ管理コマンド",
        "  download <file>     : ファイルを自分のPCへダウンロード",
        "  upload              : 自分のPCからファイルをアップロード",
        "  save / reset        : ブラウザ(IndexedDB)への環境保存・初期化",
        "  help                : コマンド一覧の表示",
        "",
        "【モード切替】",
        "  画面上部のバーから「1: 統合シェル」と「2: v86 Linux 6.8 (ttyS0)」を",
        "  いつでも切り替えられます。/mnt 内のファイルは両方で共有されます。",
        ""
      ].join("\n")
    },
    "/mnt/hello.py": {
      type: "file",
      mode: "0755",
      mtime: Date.now(),
      content: [
        "#!/usr/bin/env python3",
        "# Python 3 サンプルプログラム (python3 hello.py)",
        "import sys",
        "import platform",
        "import math",
        "",
        "print('=== Python 3 on KasouLinux ===')",
        "print(f'Python Version : {sys.version.split()[0]}')",
        "print(f'Platform       : {platform.system()} ({platform.machine()})')",
        "",
        "def fib(n):",
        "    a, b = 0, 1",
        "    res = []",
        "    for _ in range(n):",
        "        res.append(a)",
        "        a, b = b, a + b",
        "    return res",
        "",
        "nums = fib(12)",
        "print(f'Fibonacci(12)  : {nums}')",
        "print(f'Sum            : {sum(nums)}')",
        "print(f'Pi approx      : {math.pi:.8f}')",
        ""
      ].join("\n")
    },
    "/mnt/hello.c": {
      type: "file",
      mode: "0644",
      mtime: Date.now(),
      content: [
        "#include <stdio.h>",
        "",
        "/* C言語 サンプルプログラム (gcc hello.c -o hello && ./hello) */",
        "int is_prime(int n) {",
        "    if (n < 2) return 0;",
        "    for (int i = 2; i * i <= n; i++) {",
        "        if (n % i == 0) return 0;",
        "    }",
        "    return 1;",
        "}",
        "",
        "int main(void) {",
        "    printf(\"=== C Language on KasouLinux ===\\n\");",
        "    int count = 0;",
        "    int sum = 0;",
        "    printf(\"Primes up to 50: \");",
        "    for (int i = 2; i <= 50; i++) {",
        "        if (is_prime(i)) {",
        "            printf(\"%d \", i);",
        "            count++;",
        "            sum += i;",
        "        }",
        "    }",
        "    printf(\"\\nTotal primes: %d, Sum: %d\\n\", count, sum);",
        "    return 0;",
        "}",
        ""
      ].join("\n")
    },
    "/mnt/app.js": {
      type: "file",
      mode: "0755",
      mtime: Date.now(),
      content: [
        "// Node.js サンプルプログラム (node app.js)",
        "console.log('=== Node.js Runtime on KasouLinux ===');",
        "",
        "const items = [",
        "  { name: 'kernel', sizeKB: 9832 },",
        "  { name: 'initrd', sizeKB: 4120 },",
        "  { name: 'rootfs', sizeKB: 16680 },",
        "];",
        "",
        "const totalMB = (items.reduce((acc, x) => acc + x.sizeKB, 0) / 1024).toFixed(2);",
        "for (const item of items) {",
        "  console.log(` - ${item.name.padEnd(8)} : ${item.sizeKB} KB`);",
        "}",
        "console.log(`Total image size: ${totalMB} MB`);",
        ""
      ].join("\n")
    },
    "/mnt/sysinfo.sh": {
      type: "file",
      mode: "0755",
      mtime: Date.now(),
      content: [
        "#!/bin/sh",
        "# シェルスクリプト サンプル (sh sysinfo.sh)",
        "echo '=== KasouLinux Shell Script ==='",
        "echo \"Current User : $(whoami)\"",
        "echo \"Working Dir  : $(pwd)\"",
        "echo \"System Info  : $(uname -a)\"",
        "echo '--- Files in /mnt ---'",
        "ls -la /mnt",
        ""
      ].join("\n")
    }
  };

  class VirtualFileSystem {
    constructor() {
      this.entries = {};
      this.listeners = [];
      this.v86SyncHandler = null;
      this.installedPackages = {
        apk: ["busybox", "alpine-baselayout", "musl", "lua5.4", "curl", "socat"],
        pip: ["micropip"]
      };
      this.loadDefaults();
    }

    loadDefaults() {
      this.entries = {
        "/": { type: "dir", mode: "0755", mtime: Date.now() },
        "/mnt": { type: "dir", mode: "0755", mtime: Date.now() },
        "/root": { type: "dir", mode: "0755", mtime: Date.now() },
        "/tmp": { type: "dir", mode: "0777", mtime: Date.now() },
        "/bin": { type: "dir", mode: "0755", mtime: Date.now() },
        "/etc": { type: "dir", mode: "0755", mtime: Date.now() },
        "/etc/hostname": { type: "file", mode: "0644", mtime: Date.now(), content: "kasoulinux\n" },
        "/etc/os-release": {
          type: "file",
          mode: "0644",
          mtime: Date.now(),
          content: [
            'NAME="KasouLinux"',
            'VERSION="1.0 (Browser Wasm Edition)"',
            'ID=kasoulinux',
            'PRETTY_NAME="KasouLinux 1.0 (Linux 6.8 v86 + Wasm)"',
            ""
          ].join("\n")
        }
      };
      for (const [k, v] of Object.entries(DEFAULT_FILES)) {
        this.entries[k] = JSON.parse(JSON.stringify(v));
      }
    }

    normalizePath(p, cwd = "/mnt") {
      if (!p || p === "~") return "/mnt";
      if (p.startsWith("~/")) p = "/mnt/" + p.slice(2);
      const raw = p.startsWith("/") ? p : (cwd === "/" ? "/" + p : cwd + "/" + p);
      const parts = raw.split("/");
      const stack = [];
      for (const part of parts) {
        if (!part || part === ".") continue;
        if (part === "..") {
          stack.pop();
        } else {
          stack.push(part);
        }
      }
      return "/" + stack.join("/");
    }

    parentDir(p) {
      const norm = this.normalizePath(p);
      const idx = norm.lastIndexOf("/");
      return idx <= 0 ? "/" : norm.slice(0, idx);
    }

    baseName(p) {
      const norm = this.normalizePath(p);
      if (norm === "/") return "/";
      const idx = norm.lastIndexOf("/");
      return norm.slice(idx + 1);
    }

    exists(p, cwd = "/mnt") {
      const norm = this.normalizePath(p, cwd);
      return Boolean(this.entries[norm]);
    }

    isDir(p, cwd = "/mnt") {
      const norm = this.normalizePath(p, cwd);
      return this.entries[norm]?.type === "dir";
    }

    isFile(p, cwd = "/mnt") {
      const norm = this.normalizePath(p, cwd);
      return this.entries[norm]?.type === "file";
    }

    ensureDir(p) {
      const norm = this.normalizePath(p);
      if (norm === "/") return;
      const parts = norm.split("/").filter(Boolean);
      let cur = "";
      for (const part of parts) {
        cur += "/" + part;
        if (!this.entries[cur]) {
          this.entries[cur] = { type: "dir", mode: "0755", mtime: Date.now() };
        }
      }
    }

    mkdir(p, cwd = "/mnt") {
      const norm = this.normalizePath(p, cwd);
      this.ensureDir(norm);
      this.notifyChange("mkdir", norm);
      return norm;
    }

    writeFile(p, content, cwd = "/mnt", options = {}) {
      const norm = this.normalizePath(p, cwd);
      this.ensureDir(this.parentDir(norm));
      const existing = this.entries[norm];
      this.entries[norm] = {
        type: "file",
        mode: options.mode || existing?.mode || "0644",
        mtime: Date.now(),
        content: typeof content === "string" ? content : new TextDecoder().decode(content)
      };
      if (!options.skipV86Sync && this.v86SyncHandler && norm.startsWith("/mnt/")) {
        const relPath = norm.slice(4);
        this.v86SyncHandler(relPath, this.entries[norm].content);
      }
      this.notifyChange("write", norm);
      return norm;
    }

    readFile(p, cwd = "/mnt") {
      const norm = this.normalizePath(p, cwd);
      const entry = this.entries[norm];
      if (!entry) throw new Error(`${p}: No such file or directory`);
      if (entry.type === "dir") throw new Error(`${p}: Is a directory`);
      return entry.content ?? "";
    }

    unlink(p, cwd = "/mnt", recursive = false) {
      const norm = this.normalizePath(p, cwd);
      if (norm === "/" || norm === "/mnt") {
        throw new Error(`Cannot remove protected directory: ${norm}`);
      }
      if (!this.entries[norm]) {
        throw new Error(`${p}: No such file or directory`);
      }
      if (this.entries[norm].type === "dir") {
        const children = this.listDir(norm);
        if (children.length > 0 && !recursive) {
          throw new Error(`${p}: Directory not empty (use -r)`);
        }
        for (const k of Object.keys(this.entries)) {
          if (k === norm || k.startsWith(norm + "/")) {
            delete this.entries[k];
          }
        }
      } else {
        delete this.entries[norm];
      }
      this.notifyChange("delete", norm);
    }

    listDir(dirPath = "/mnt", cwd = "/mnt") {
      const norm = this.normalizePath(dirPath, cwd);
      if (!this.entries[norm]) {
        throw new Error(`${dirPath}: No such file or directory`);
      }
      if (this.entries[norm].type !== "dir") {
        return [{
          name: this.baseName(norm),
          path: norm,
          ...this.entries[norm],
          size: (this.entries[norm].content || "").length
        }];
      }
      const prefix = norm === "/" ? "/" : norm + "/";
      const items = [];
      for (const [k, v] of Object.entries(this.entries)) {
        if (k === norm || !k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (rest && !rest.includes("/")) {
          items.push({
            name: rest,
            path: k,
            type: v.type,
            mode: v.mode || (v.type === "dir" ? "0755" : "0644"),
            mtime: v.mtime || Date.now(),
            size: v.type === "dir" ? 4096 : new Blob([v.content || ""]).size
          });
        }
      }
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return items;
    }

    onChange(fn) {
      this.listeners.push(fn);
    }

    notifyChange(action, path) {
      if (action !== "restore" && action !== "reset") {
        this.saveToIndexedDB();
      }
      for (const fn of this.listeners) {
        try {
          fn(action, path);
        } catch (err) {
          console.error(err);
        }
      }
    }

    openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_VFS)) {
            db.createObjectStore(STORE_VFS);
          }
          if (!db.objectStoreNames.contains(STORE_VM)) {
            db.createObjectStore(STORE_VM);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async saveToIndexedDB() {
      try {
        localStorage.setItem(
          "KasouLinuxVFS_v1",
          JSON.stringify({
            entries: this.entries,
            installedPackages: this.installedPackages,
            savedAt: Date.now()
          })
        );
      } catch (e) {
        console.warn("Storage save warning:", e);
      }
      return true;
    }

    async loadFromIndexedDB() {
      try {
        const raw = localStorage.getItem("KasouLinuxVFS_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.entries) {
            this.entries = parsed.entries;
            if (parsed.installedPackages) {
              this.installedPackages = parsed.installedPackages;
            }
            this.notifyChange("restore", "/mnt");
            return parsed.savedAt || Date.now();
          }
        }
      } catch (e) {
        console.warn("Storage load skipped:", e);
      }
      return null;
    }

    async clearIndexedDB() {
      try {
        localStorage.removeItem("KasouLinuxVFS_v1");
      } catch (_) {}
      this.loadDefaults();
      this.notifyChange("reset", "/mnt");
      return true;
    }
  }

  global.KasouVFS = new VirtualFileSystem();
})(window);
