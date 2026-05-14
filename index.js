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
app.get("/", (req, res) => res.send("AFK Bot is running!"));
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
