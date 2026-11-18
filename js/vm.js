/**
 * KasouLinux v86 Real Linux 6.8 Kernel Controller
 * Runs buildroot-bzimage68.bin in WebAssembly and seamlessly executes
 * Linux kernel / BusyBox commands for the unified terminal.
 */

(function (global) {
  "use strict";

  const vfs = global.KasouVFS;
  const runtime = global.KasouRuntime;

  class V86Manager {
    constructor() {
      this.emulator = null;
      this.isBooted = false;
      this.serialBuf = "";
      this.onStatusChange = null;
      this.activeJob = null;
    }

    setStatus(state, label) {
      if (this.onStatusChange) {
        this.onStatusChange(state, label);
      }
    }

    start() {
      if (!global.V86) {
        this.setStatus("error", "v86未読込");
        return;
      }

      this.isBooted = false;
      this.serialBuf = "";
      this.setStatus("booting", "Linux 6.8 カーネル起動中...");

      this.emulator = new global.V86({
        wasm_path: "assets/v86/v86.wasm",
        memory_size: 64 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        bios: { url: "assets/v86/seabios.bin" },
        vga_bios: { url: "assets/v86/vgabios.bin" },
        bzimage: {
          url: "assets/v86/buildroot-bzimage68.bin",
          size: 10068480,
          async: false
        },
        filesystem: {},
        network_relay_url: "wss://relay.widgetry.org/",
        cmdline: "tsc=reliable mitigations=off random.trust_cpu=on",
        autostart: true,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true
      });

      this.syncAllVfsTo9p();

      vfs.v86SyncHandler = (relPath, contentStr) => {
        if (!this.emulator) return;
        try {
          const bytes = new TextEncoder().encode(contentStr);
          this.emulator.create_file(relPath, bytes);
        } catch (e) {
          // Ignore 9p sync warning on nested paths
        }
      };

      this.emulator.add_listener("serial0-output-byte", (byte) => {
        const ch = String.fromCharCode(byte);
        this.serialBuf += ch;
        if (this.serialBuf.length > 8192) {
          this.serialBuf = this.serialBuf.slice(-4096);
        }

        if (!this.isBooted && this.serialBuf.endsWith("~% ")) {
          this.isBooted = true;
          this.setStatus("ready", "Linux 6.8 稼働中");
          this.sendSerial("stty -echo; cd /mnt\n");
          return;
        }

        if (this.activeJob) {
          this.activeJob.buf += ch;
          const endMatch = this.activeJob.buf.match(/__KASOU_DONE_(\d+)__\r?\n?/);
          if (endMatch) {
            const exitCode = parseInt(endMatch[1], 10) || 0;
            let rawOut = this.activeJob.buf.slice(0, endMatch.index);
            // Strip everything up to and including __KASOU_START__ across multiple lines
            rawOut = rawOut.replace(/^[\s\S]*?__KASOU_START__\r?\n?/, "");
            rawOut = rawOut.replace(/~%\s*$/, "");
            const job = this.activeJob;
            this.activeJob = null;
            job.resolve({ code: exitCode, output: rawOut });
          }
        }
      });

      runtime.v86ExecCallback = (cmd, cwd, onStream) => this.execCommand(cmd, cwd, onStream);
      runtime.isV86Ready = () => this.isBooted;
    }

    syncAllVfsTo9p() {
      if (!this.emulator) return;
      const enc = new TextEncoder();
      for (const [fullPath, entry] of Object.entries(vfs.entries)) {
        if (fullPath.startsWith("/mnt/") && entry.type === "file") {
          const relPath = fullPath.slice(4);
          try {
            this.emulator.create_file(relPath, enc.encode(entry.content || ""));
          } catch (_) {}
        }
      }
    }

    sendSerial(str) {
      if (!this.emulator) return;
      this.emulator.serial0_send(str);
    }

    execCommand(cmd, cwd = "/mnt", onStream = null) {
      if (!this.emulator || !this.isBooted) {
        return Promise.resolve({
          code: 1,
          output: "[Linux 6.8 カーネルをブート中です。あと数秒お待ちください]\n"
        });
      }

      return new Promise((resolve) => {
        this.activeJob = {
          buf: "",
          resolve: (res) => {
            if (onStream && res.output) onStream(res.output);
            resolve(res);
          }
        };

        const targetDir = cwd.startsWith("/mnt") ? cwd : "/mnt";
        const wrapped = `cd "${targetDir}" 2>/dev/null; echo "__KASOU_START__"; ${cmd}; echo "__KASOU_DONE_$?__"\n`;
        this.sendSerial(wrapped);

        setTimeout(() => {
          if (this.activeJob) {
            const partial = this.activeJob.buf.replace(/^[\s\S]*?__KASOU_START__\r?\n?/, "");
            const job = this.activeJob;
            this.activeJob = null;
            job.resolve({ code: 124, output: partial ? partial + "\n" : "" });
          }
        }, 8000);
      });
    }

    restart() {
      if (this.emulator) {
        this.isBooted = false;
        this.serialBuf = "";
        this.setStatus("booting", "Linux 6.8 再起動中...");
        this.emulator.restart();
      }
    }
  }

  global.KasouVM = new V86Manager();
})(window);
