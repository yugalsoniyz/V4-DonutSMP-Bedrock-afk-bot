const http = require("http");
const fs = require("fs");
const path = require("path");

const settings = JSON.parse(
  fs.readFileSync(path.join(__dirname, "settings.json"), "utf8")
);

const PORT = process.env.PORT || 3000;
const mcHost = settings.server.host;
const mcPort = Number(settings.server.port);
const username = settings.bot.username;

const state = {
  status: "Starting",
  server: `${mcHost}:${mcPort}`,
  username,
  startedAt: Date.now(),
  connectedAt: null,
  reconnects: 0,
  lastEvent: "Starting bot...",
  position: null,
  blockPosition: null,
  blockName: null,
  blockDisplayName: null
};

function updateState(values) {
  Object.assign(state, values);
  console.log(`[BOT] ${values.lastEvent || values.status || ""}`);
}

global.botState = state;
global.updateBotState = updateState;
global.botSettings = settings;

require("./bot");

const server = http.createServer((req, res) => {
  if (req.url === "/api/status") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    });
    res.end(JSON.stringify({
      ...state,
      uptime: Math.floor((Date.now() - state.startedAt) / 1000)
    }));
    return;
  }

  if (req.url === "/" || req.url === "/index.html") {
    const file = fs.readFileSync(
      path.join(__dirname, "public", "index.html")
    );
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });
    res.end(file);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard listening on port ${PORT}`);
});