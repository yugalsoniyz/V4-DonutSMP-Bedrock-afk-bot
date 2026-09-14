# Bedrock Railway Bot

## Files

- `package.json` — dependencies and start command
- `settings.json` — server, username, reconnect settings
- `server.js` — web dashboard/API
- `bot.js` — Bedrock bot
- `public/index.html` — dashboard
- `.gitignore` — files that should not be committed

## Important package fix

The block-name version uses `prismarine-bedrock` directly from its GitHub repository because that project is currently maintained there rather than being installed as a normal npm-registry dependency.

Railway should run:

```text
npm start
```

## Block name

The bot enables Bedrock world/chunk decoding and uses `getBlock()` to look up the block under the player's feet. The dashboard shows the human-readable block name, internal block name, and block coordinates.

If the chunk has not arrived yet, it shows `Waiting for world data...`.

The bot uses normal Microsoft authentication. It does not bypass CAPTCHA, verification, or server access controls.
