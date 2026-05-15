const mineflayer = require("mineflayer");
const express = require("express");

// ─── CONFIG ────────────────────────────────────────────────────────────────
const HOST = "Alpheus0.aternos.me"; // ← Your Aternos address
const PORT = 44710;
const USERNAME = "AFKBot";
const MIN_RECONNECT_MS = 15000;   // Wait at least 15s before reconnecting
const MAX_RECONNECT_MS = 60000;   // Cap at 1 minute max wait
// ───────────────────────────────────────────────────────────────────────────

// Keep-alive web server
const app = express();
app.get("/", (req, res) => res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AFK Bot Dashboard</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#0f1117;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:2rem;width:420px}.header{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem}.dot{width:10px;height:10px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}.title{font-size:18px;font-weight:600}.sub{font-size:13px;color:#888;margin-top:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.5rem}.metric{background:#12141c;border-radius:8px;padding:.875rem}.mlabel{font-size:11px;color:#666;margin-bottom:4px}.mval{font-size:20px;font-weight:600}.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a2d3a;font-size:13px}.row:last-child{border-bottom:none}.badge{background:#14532d;color:#22c55e;border-radius:99px;padding:2px 10px;font-size:12px}</style></head><body><div class="card"><div class="header"><div class="dot"></div><div><div class="title">AFK Bot</div><div class="sub">Alpheus0.aternos.me:44710</div></div><span class="badge" style="margin-left:auto">Online</span></div><div class="grid"><div class="metric"><div class="mlabel">Uptime</div><div class="mval" id="up">0:00:00</div></div><div class="metric"><div class="mlabel">Version</div><div class="mval" style="font-size:15px;padding-top:4px">1.21.4</div></div><div class="metric"><div class="mlabel">Username</div><div class="mval" style="font-size:15px;padding-top:4px">AFKBot</div></div><div class="metric"><div class="mlabel">Auth</div><div class="mval" style="font-size:15px;padding-top:4px">Offline</div></div></div><div class="row"><span style="color:#888">Server</span><span>PaperMC 1.21.4</span></div><div class="row"><span style="color:#888">Movement</span><span class="badge">Active</span></div><div class="row"><span style="color:#888">Web server</span><span class="badge">Running</span></div></div><script>const s=Date.now();setInterval(()=>{const e=Math.floor((Date.now()-s)/1000);const h=Math.floor(e/3600);const m=Math.floor((e%3600)/60);const sec=e%60;document.getElementById("up").textContent=h+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0")},1000);</script></body></html>`));
app.listen(process.env.PORT || 3000, () => console.log("Keep-alive server started"));

let reconnectDelay = MIN_RECONNECT_MS;
let reconnectTimeout = null;
let isReconnecting = false; // ← prevents double reconnect

function createBot() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  isReconnecting = false;

  console.log(`[${new Date().toLocaleTimeString()}] Connecting to ${HOST}...`);

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: "1.21.4", // ← set your actual Minecraft version
    skipValidation: true,  // skip ping before connecting
    auth: "offline",
    hideErrors: false,
    checkTimeoutInterval: 30000,
  });

  let moveInterval = null;
  let lookInterval = null;

  function randomMove() {
    const controls = ["forward", "back", "left", "right", "forward", "forward"];
    const move = controls[Math.floor(Math.random() * controls.length)];
    const duration = 500 + Math.random() * 2000;

    if (bot.entity) {
      bot.setControlState(move, true);

      if (Math.random() > 0.5) {
        setTimeout(() => {
          if (bot.entity) {
            bot.setControlState("jump", true);
            setTimeout(() => bot.setControlState("jump", false), 300);
          }
        }, Math.random() * duration);
      }

      setTimeout(() => {
        bot.setControlState(move, false);
      }, duration);
    }
  }

  function randomLook() {
    if (!bot.entity) return;
    const yaw = (Math.random() * 2 - 1) * Math.PI;
    const pitch = (Math.random() - 0.5) * Math.PI / 2;
    bot.look(yaw, pitch, true);
  }

  function cleanup() {
    clearInterval(moveInterval);
    clearInterval(lookInterval);
    moveInterval = null;
    lookInterval = null;
  }

  function scheduleReconnect(reason) {
    // ← if already reconnecting, ignore duplicate events
    if (isReconnecting) return;
    isReconnecting = true;

    cleanup();
    console.log(`[${new Date().toLocaleTimeString()}] ⚠️  ${reason}`);
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Reconnecting in ${reconnectDelay / 1000}s...`);
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
      createBot();
    }, reconnectDelay);
  }

  bot.on("login", () => {
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Bot logged in as ${bot.username}`);
    reconnectDelay = MIN_RECONNECT_MS;
  });

  bot.once("spawn", () => {
    console.log(`[${new Date().toLocaleTimeString()}] 🌍 Bot spawned, starting movement...`);
    moveInterval = setInterval(randomMove, 30000);
    lookInterval = setInterval(randomLook, 20000);
    setTimeout(randomMove, 3000);
    setTimeout(randomLook, 5000);
  });

  bot.on("kicked", (reason) => {
    let parsed = reason;
    try {
      if (typeof reason === "object") {
        parsed = reason.text || reason.translate || JSON.stringify(reason);
      } else {
        parsed = JSON.parse(reason)?.text || reason;
      }
    } catch {}
    const parsedStr = String(parsed).toLowerCase();
    if (parsedStr.includes("throttl")) {
      reconnectDelay = MAX_RECONNECT_MS;
    }
    scheduleReconnect(`Kicked: ${parsed}`);
  });

  bot.on("error", (err) => {
    if (err.code === "ECONNRESET") return;
    scheduleReconnect(`Error: ${err.message}`);
  });

  bot.on("end", () => {
    scheduleReconnect("Bot disconnected.");
  });
}

createBot();
