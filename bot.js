const fs = require("fs");
const path = require("path");
const { createBot } = require("prismarine-bedrock");

const settings = JSON.parse(
  fs.readFileSync(path.join(__dirname, "settings.json"), "utf8")
);

const HOST = settings.server.host;
const PORT = Number(settings.server.port);
const USERNAME = settings.bot.username;

const RECONNECT_ENABLED = settings.reconnect.enabled !== false;

let reconnectTimer = null;
let blockTimer = null;
let reconnectDelay =
  Number(settings.reconnect.initialDelayMs) || 5000;

const maxReconnectDelay =
  Number(settings.reconnect.maxDelayMs) || 60000;

let bot = null;

function log(status, message, extra = {}) {
  if (global.updateBotState) {
    global.updateBotState({
      status,
      server: `${HOST}:${PORT}`,
      username: USERNAME,
      lastEvent: message,
      ...extra
    });
  }

  console.log(`[BOT] ${message}`);
}

function savePosition(position) {
  if (!position) return;

  const x = Number(position.x);
  const y = Number(position.y);
  const z = Number(position.z);

  if (![x, y, z].every(Number.isFinite)) return;

  if (global.updateBotState) {
    global.updateBotState({
      position: { x, y, z },
      blockPosition: {
        x: Math.floor(x),
        y: Math.floor(y - 0.001),
        z: Math.floor(z)
      }
    });
  }
}

async function updateBlockName() {
  if (!bot || !bot.self || !bot.self.position) return;

  const p = bot.self.position;
  savePosition(p);

  try {
    // Wait for the world/chunk around the player, then read the block
    // immediately underneath the player's feet.
    await bot.waitForChunksToLoad({
      position: p,
      radius: 0,
      timeoutMs: 5000
    });

    const block = await bot.getBlock({
      x: Math.floor(Number(p.x)),
      y: Math.floor(Number(p.y) - 0.001),
      z: Math.floor(Number(p.z))
    });

    if (!block) {
      if (global.updateBotState) {
        global.updateBotState({
          blockName: null,
          blockDisplayName: null,
          lastEvent: "Waiting for block/world data..."
        });
      }
      return;
    }

    const name = block.name || "unknown";
    const displayName = block.displayName || name;

    if (global.updateBotState) {
      global.updateBotState({
        blockName: name,
        blockDisplayName: displayName,
        blockPosition: {
          x: Math.floor(Number(p.x)),
          y: Math.floor(Number(p.y) - 0.001),
          z: Math.floor(Number(p.z))
        },
        lastEvent: `Standing on ${displayName}`
      });
    }
  } catch (err) {
    if (global.updateBotState) {
      global.updateBotState({
        blockName: null,
        blockDisplayName: null,
        lastEvent: "Waiting for world data..."
      });
    }
  }
}

function startBlockWatcher() {
  stopBlockWatcher();

  // Give the server a moment to send the initial chunks.
  setTimeout(() => {
    updateBlockName();
    blockTimer = setInterval(updateBlockName, 2000);
  }, 1500);
}

function stopBlockWatcher() {
  if (blockTimer) {
    clearInterval(blockTimer);
    blockTimer = null;
  }
}

function connect() {
  log("Connecting", `Connecting to ${HOST}:${PORT}...`);

  try {
    bot = createBot({
      host: HOST,
      port: PORT,
      offline: false,
      profilesFolder: path.join(__dirname, ".minecraft"),
      username: USERNAME,

      // World decoding is required for getBlock().
      worldDecodeEnabled: true,
      physicsEnabled: true,
      chunkRadius: 6,
      loggingEnabled: false,

      onMsaCode: (data) => {
        console.log("");
        console.log("=== MICROSOFT LOGIN REQUIRED ===");
        console.log(`URL:  ${data.verification_uri}`);
        console.log(`CODE: ${data.user_code}`);
        console.log("================================");
        console.log("");

        log(
          "Authentication",
          `Microsoft login required. Code: ${data.user_code}`
        );
      }
    });
  } catch (err) {
    log("Error", `Create client failed: ${err.message}`);
    scheduleReconnect();
    return;
  }

  bot.on("join", () => {
    reconnectDelay =
      Number(settings.reconnect.initialDelayMs) || 5000;

    log("Online", "Joined the server.", {
      connectedAt: Date.now()
    });
  });

  bot.on("spawn", () => {
    log("Online", "Player spawned.");
    startBlockWatcher();
  });

  bot.on("move_player", (packet) => {
    if (packet && packet.position) {
      savePosition(packet.position);
    }
  });

  bot.on("close", (reason) => {
    stopBlockWatcher();

    log(
      "Disconnected",
      `Connection closed: ${formatReason(reason)}`
    );

    scheduleReconnect();
  });

  bot.on("error", (err) => {
    log(
      "Error",
      `Connection error: ${err.message || err}`
    );
  });

  bot.on("kick", (reason) => {
    log(
      "Kicked",
      `Server kicked the bot: ${formatReason(reason)}`
    );
  });

  bot.on("text", (packet) => {
    if (packet?.message) {
      console.log(`[CHAT] ${packet.message}`);
    }
  });
}

function scheduleReconnect() {
  if (!RECONNECT_ENABLED || reconnectTimer) return;

  const delay = reconnectDelay;

  if (global.botState) {
    global.botState.reconnects++;
  }

  log(
    "Reconnecting",
    `Reconnecting in ${Math.round(delay / 1000)} seconds...`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    reconnectDelay = Math.min(
      reconnectDelay * 1.5,
      maxReconnectDelay
    );

    connect();
  }, delay);
}

function formatReason(reason) {
  if (!reason) return "Unknown reason";
  if (typeof reason === "string") return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

if (!HOST || HOST === "play.example.com") {
  log(
    "Error",
    "Edit settings.json and set your real server host/port."
  );
} else {
  connect();
}
