/**
 * KasouLinux Unified Full-Screen Native DOM Terminal Controller
 * Instant response, zero canvas focus bugs, full IME & keyboard support.
 */

(function (global) {
  "use strict";

  const vfs = global.KasouVFS;
  const runtime = global.KasouRuntime;
  const vm = global.KasouVM;

  let histIndex = -1;
  let activeEditPath = "/mnt/hello.py";

  function showToast(msg) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function ansiToHtml(text) {
    const escaped = escapeHtml(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
    let openSpan = false;
    return escaped.replace(/\x1b\[([0-9;]*)m/g, (_, code) => {
      let prefix = openSpan ? "</span>" : "";
      openSpan = false;
      if (code === "0" || code === "") {
        return prefix;
      }
      let cls = "";
      if (code.includes("32")) cls = "ansi-green";
      else if (code.includes("34")) cls = "ansi-blue";
      else if (code.includes("36")) cls = "ansi-cyan";
      else if (code.includes("33")) cls = "ansi-yellow";
      else if (code.includes("31")) cls = "ansi-red";
      else if (code.includes("90")) cls = "ansi-gray";

      if (cls) {
        openSpan = true;
        return `${prefix}<span class="${cls}">`;
      }
      return prefix;
    }) + (openSpan ? "</span>" : "");
  }

  function getPromptHtml() {
    const dir = runtime.cwd === "/mnt" ? "~" : escapeHtml(runtime.cwd.replace(/^\/mnt/, "~"));
    return `<span class="ansi-green">user@kasoulinux</span>:<span class="ansi-blue">${dir}</span>$ `;
  }

  function updatePromptLabels() {
    const label = document.getElementById("term-prompt-label");
    if (label) {
      label.innerHTML = getPromptHtml();
    }
  }

  function scrollToBottom() {
    const screen = document.getElementById("term-screen");
    if (screen) {
      screen.scrollTop = screen.scrollHeight;
    }
  }

  function appendOutputHtml(htmlStr) {
    const log = document.getElementById("term-log");
    if (!log) return;
    const span = document.createElement("span");
    span.innerHTML = htmlStr;
    log.appendChild(span);
    scrollToBottom();
  }

  function appendOutputText(text) {
    if (!text) return;
    appendOutputHtml(ansiToHtml(text));
  }

  async function executeUserCommand(rawCmd) {
    const log = document.getElementById("term-log");
    const cmd = String(rawCmd || "");
    histIndex = -1;

    // Echo prompt + command line into log
    appendOutputHtml(getPromptHtml() + escapeHtml(cmd) + "\n");

    const trimmed = cmd.trim();
    if (!trimmed) {
      updatePromptLabels();
      scrollToBottom();
      return;
    }

    if (trimmed === "clear") {
      if (log) log.innerHTML = "";
      updatePromptLabels();
      scrollToBottom();
      return;
    }

    try {
      await runtime.executeCommandLine(trimmed, (chunk) => {
        appendOutputText(chunk);
      });
    } catch (err) {
      appendOutputText(`Error: ${err.message || err}\n`);
    }

    updatePromptLabels();
    scrollToBottom();
  }

  // ==========================================================================
  // In-Terminal Editor (for vi / vim / nano / edit commands)
  // ==========================================================================
  function openInTerminalEditor(filePath) {
    const norm = vfs.normalizePath(filePath, runtime.cwd);
    if (!vfs.exists(norm)) {
      vfs.writeFile(norm, "", runtime.cwd);
    }
    activeEditPath = norm;
    const overlay = document.getElementById("term-editor-overlay");
    const pathEl = document.getElementById("nano-filepath");
    const textarea = document.getElementById("nano-textarea");
    const statusEl = document.getElementById("nano-status");

    if (pathEl) pathEl.textContent = norm;
    if (textarea) textarea.value = vfs.readFile(norm);
    if (statusEl) statusEl.textContent = "Ctrl+S: 保存 | Ctrl+R: 保存して実行 | Esc: 終了";

    overlay.classList.remove("hidden");
    setTimeout(() => {
      if (textarea) textarea.focus();
    }, 20);
  }

  function saveInTerminalEditor() {
    const textarea = document.getElementById("nano-textarea");
    const statusEl = document.getElementById("nano-status");
    if (!textarea) return;
    vfs.writeFile(activeEditPath, textarea.value, runtime.cwd);
    if (statusEl) {
      statusEl.textContent = `[保存完了: ${activeEditPath} (${textarea.value.length} bytes)]`;
    }
  }

  function closeInTerminalEditor(saveChanges = true) {
    const overlay = document.getElementById("term-editor-overlay");
    const inlineInput = document.getElementById("term-inline-input");
    if (overlay && !overlay.classList.contains("hidden")) {
      if (saveChanges) {
        saveInTerminalEditor();
        appendOutputText(`\x1b[1;32m[保存してエディタを閉じました: ${activeEditPath}]\x1b[0m\n`);
      }
      overlay.classList.add("hidden");
      if (inlineInput) inlineInput.focus();
    }
  }

  async function saveAndRunFromEditor() {
    saveInTerminalEditor();
    closeInTerminalEditor(false);

    let cmd = "";
    if (activeEditPath.endsWith(".py")) {
      cmd = `python3 ${activeEditPath}`;
    } else if (activeEditPath.endsWith(".c")) {
      const binOut = activeEditPath.replace(/\.c$/, "");
      cmd = `gcc ${activeEditPath} -o ${binOut} && ${binOut}`;
    } else if (activeEditPath.endsWith(".js")) {
      cmd = `node ${activeEditPath}`;
    } else if (activeEditPath.endsWith(".sh")) {
      cmd = `sh ${activeEditPath}`;
    } else {
      cmd = `cat ${activeEditPath}`;
    }

    await executeUserCommand(cmd);
  }

  function animateSteamLocomotive() {
    return new Promise((resolve) => {
      const log = document.getElementById("term-log");
      if (!log) return resolve();

      const pre = document.createElement("pre");
      pre.style.fontFamily = "inherit";
      pre.style.lineHeight = "1.2";
      pre.style.color = "#f3f4f6";
      pre.style.overflow = "hidden";
      log.appendChild(pre);

      const trainBody = [
        "      ====        ________                ___________ ",
        "  _D _|  |_______/        \\__I_I_____===__|_________| ",
        "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
        "   /     |  |   H  |  |     |   |         ||_| |_||   ",
        "  |      |  |   H  |__--------------------| [___] |   ",
        "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
        "  |/ |   |-----------I_____I [][] []  D   |=======|__ "
      ];
      const wheelsA = [
        "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
        " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
        "  \\_/      \\O=====O=====O=====O_/      \\_/            "
      ];
      const wheelsB = [
        "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
        " |/-=|___|=   O=====O=====O=====O|_____/~\\___/        ",
        "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            "
      ];
      const smokeA = [
        "                            (  ) (@@) ( )  (@)  ()    ",
        "                       (@@@)                          ",
        "                   (    )                             ",
        "                (@@@@)                                "
      ];
      const smokeB = [
        "                      (@@) (  ) (@)  ( )  @@          ",
        "                   (   )                              ",
        "                (@@@@)                                ",
        "             (  )                                     "
      ];

      let pos = 52;
      const timer = setInterval(() => {
        const pad = " ".repeat(Math.max(0, pos));
        const smoke = pos % 2 === 0 ? smokeA : smokeB;
        const wheels = pos % 2 === 0 ? wheelsA : wheelsB;
        const lines = [...smoke, ...trainBody, ...wheels].map((l) => pad + l);
        pre.textContent = lines.join("\n") + "\n";
        scrollToBottom();
        pos -= 2;
        if (pos < 0) {
          clearInterval(timer);
          resolve();
        }
      }, 65);
    });
  }

  // ==========================================================================
  // Input Wiring (Both Inline Terminal Prompt & Bottom Command Bar)
  // ==========================================================================
  function handleHistoryAndTab(e, inputEl) {
    if (e.key === "ArrowUp") {
      if (runtime.history.length > 0) {
        e.preventDefault();
        if (histIndex < 0) histIndex = runtime.history.length - 1;
        else if (histIndex > 0) histIndex--;
        inputEl.value = runtime.history[histIndex] || "";
      }
    } else if (e.key === "ArrowDown") {
      if (histIndex >= 0) {
        e.preventDefault();
        histIndex++;
        if (histIndex >= runtime.history.length) {
          histIndex = -1;
          inputEl.value = "";
        } else {
          inputEl.value = runtime.history[histIndex];
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const parts = inputEl.value.split(/\s+/);
      const prefix = parts[parts.length - 1] || "";
      try {
        const candidates = vfs
          .listDir(runtime.cwd)
          .map((it) => (it.type === "dir" ? it.name + "/" : it.name))
          .filter((name) => name.startsWith(prefix));
        if (candidates.length === 1) {
          parts[parts.length - 1] = candidates[0];
          inputEl.value = parts.join(" ");
        }
      } catch (_) {}
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      const log = document.getElementById("term-log");
      if (log) log.innerHTML = "";
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      appendOutputHtml(getPromptHtml() + escapeHtml(inputEl.value) + "^C\n");
      inputEl.value = "";
    }
  }

  function initApp() {
    const termScreen = document.getElementById("term-screen");
    const inlineInput = document.getElementById("term-inline-input");
    const cmdInput = document.getElementById("cmd-input");
    const cmdSendBtn = document.getElementById("cmd-send-btn");

    // 1. Print initial welcome message immediately
    appendOutputText(
      [
        "\x1b[1;36mKasouLinux Unified Terminal (Linux 6.8 + Wasm Runtimes)\x1b[0m",
        "----------------------------------------------------------------------",
        "・ファイル一覧: \x1b[1;33mls -la\x1b[0m  | ファイル編集: \x1b[1;33mvi hello.py\x1b[0m  | ヘルプ: \x1b[1;33mhelp\x1b[0m",
        "・Python実行  : \x1b[1;33mpython3 hello.py\x1b[0m",
        "・C言語実行   : \x1b[1;33mgcc hello.c -o hello && ./hello\x1b[0m",
        "・Node.js実行 : \x1b[1;33mnode app.js\x1b[0m",
        ""
      ].join("\n") + "\n"
    );
    updatePromptLabels();

    // 2. Wire inline terminal input & bottom bar input synchronously
    if (termScreen && inlineInput) {
      termScreen.addEventListener("click", () => {
        const sel = window.getSelection();
        if (!sel || sel.toString().length === 0) {
          inlineInput.focus();
        }
      });

      inlineInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = inlineInput.value;
          inlineInput.value = "";
          await executeUserCommand(val);
          inlineInput.focus();
        } else {
          handleHistoryAndTab(e, inlineInput);
        }
      });
    }

    const triggerCommandSubmit = async () => {
      const val = cmdInput.value.trim() !== "" ? cmdInput.value : inlineInput.value;
      cmdInput.value = "";
      inlineInput.value = "";
      await executeUserCommand(val);
      inlineInput.focus();
    };

    if (cmdSendBtn) {
      cmdSendBtn.onclick = triggerCommandSubmit;
    }

    if (cmdInput) {
      cmdInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          await triggerCommandSubmit();
        } else {
          handleHistoryAndTab(e, cmdInput);
        }
      });
    }

    // 3. Wire In-Terminal Editor (vi / nano) & animations
    runtime.openEditorCallback = (filePath) => openInTerminalEditor(filePath);
    runtime.uploadCallback = () => document.getElementById("file-upload-input")?.click();
    runtime.slAnimateCallback = () => animateSteamLocomotive();

    document.getElementById("btn-nano-save").onclick = saveInTerminalEditor;
    document.getElementById("btn-nano-run").onclick = saveAndRunFromEditor;
    document.getElementById("btn-nano-close").onclick = closeInTerminalEditor;

    const nanoTextarea = document.getElementById("nano-textarea");
    if (nanoTextarea) {
      nanoTextarea.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveInTerminalEditor();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
          e.preventDefault();
          saveAndRunFromEditor();
        } else if (e.key === "Escape" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x")) {
          e.preventDefault();
          closeInTerminalEditor();
        }
      });
    }

    // 4. Wire Top Bar buttons
    const uploadInput = document.getElementById("file-upload-input");
    document.getElementById("btn-top-upload").onclick = () => uploadInput.click();
    uploadInput.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = () => {
          const dst = vfs.writeFile(file.name, String(reader.result || ""), runtime.cwd);
          showToast(`読み込み完了: ${dst}`);
        };
        reader.readAsText(file);
      }
      uploadInput.value = "";
    };

    document.getElementById("btn-top-save").onclick = async () => {
      await vfs.saveToIndexedDB();
      showToast("現在の環境をブラウザに保存しました");
    };

    document.getElementById("btn-top-reset").onclick = async () => {
      if (!confirm("ファイルと環境を初期状態にリセットしますか？")) return;
      await vfs.clearIndexedDB();
      showToast("初期状態にリセットしました");
    };

    // 5. Restore saved files & start v86 background kernel non-blockingly
    vfs.loadFromIndexedDB().then((savedTime) => {
      if (savedTime) {
        const d = new Date(savedTime).toLocaleString("ja-JP");
        showToast(`保存済みデータを復元しました (${d})`);
      }
    });

    vm.onStatusChange = (state, label) => {
      const dot = document.getElementById("vm-status-dot");
      const text = document.getElementById("vm-status-text");
      if (dot) dot.className = "status-dot" + (state === "ready" ? " ready" : "");
      if (text) text.textContent = label;
    };

    setTimeout(() => {
      try {
        vm.start();
      } catch (e) {
        console.warn("Background VM start warning:", e);
      }
    }, 100);

    if (inlineInput) {
      inlineInput.focus();
    }
  }

  global.KasouUI = {
    rebootVM: () => {
      vm.restart();
      showToast("Linux 6.8 カーネルを再起動しています...");
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})(window);
