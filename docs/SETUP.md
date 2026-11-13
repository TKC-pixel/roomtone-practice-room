# Project setup and deployment

For the free hosted rehearsal preview, follow [Render deployment](RENDER.md). The repository includes a `render.yaml` for a free Node web service. Its room-data file is ephemeral; keep local copies of important setlists.

## Local installation

Install Node.js 22.9 or newer and a desktop browser with the input support you need, such as Chrome or Edge. Check `node --version` and `npm --version` in a new terminal. The Node requirement comes from the start command's optional `.env` loader.

Extract `Roomtone.zip` into a folder, then open a terminal in the folder containing `package.json`, `server.mjs`, and `public`. The ZIP contains those files directly; it does not include dependencies or your room data. There is no separate frontend build or database installation.

On Windows PowerShell, replace the example folder with your extracted location:

```powershell
cd 'C:\path\to\roomtone'
npm ci
Copy-Item .env.example .env
npm start
```

On macOS or Linux:

```sh
cd /path/to/roomtone
npm ci
cp .env.example .env
npm start
```

The included `.env` contains public-safe local defaults. Copy the template only to reset defaults; preserve your existing `.env` when updating. The repository intentionally includes this defaults file. Supply real passwords and TURN credentials through the host process environment, not committed files. Its default settings require no accounts, login service, or server password. `package-lock.json` fixes the runtime dependency version.

Keep the terminal open and visit **http://localhost:8787/**. Opening `public/index.html` directly will not connect the app. Visit **http://localhost:8787/health** if you need to confirm the server is responding; a running server returns JSON containing `"ok": true`.

Click **Join room**, enter a display name, choose an instrument, and enter a room code. The first browser to join a new code becomes owner. Share that code with the band; no email or sign-up is required. See [the user manual](../USER_MANUAL.md) for creating rooms, assigning MD, and operating the mixer.

Use **Ctrl+C** to stop the server. To start it on another day, open the same folder and run `npm start`. Run `npm ci` again when the project's dependencies change.

If PowerShell blocks `npm.ps1`, run `npm.cmd ci` and `npm.cmd start` instead. If an npm cache location is unwritable, use `npm ci --cache ./npm-cache` in a writable folder.

## Environment variables

Copy `.env.example` to `.env`. Restart the server after edits. Shell environment variables take precedence over `.env` values.

| Variable         | Default           | Purpose                                                                        |
| ---------------- | ----------------- | ------------------------------------------------------------------------------ |
| HOST             | 127.0.0.1         | Listen address. Use 0.0.0.0 only when other machines or a proxy must connect.  |
| PORT             | 8787              | HTTP/HTTPS listening port.                                                     |
| MAX_PARTICIPANTS | 8                 | Per-room participant cap. Raising it does not add media capacity.              |
| ROOM_PASSWORD    | empty             | Optional shared server password; enter via app Settings.                       |
| ROOMTONE_CERT    | unset             | PEM certificate chain path for direct HTTPS.                                   |
| ROOMTONE_KEY     | unset             | PEM private-key path; requires ROOMTONE_CERT too.                              |
| ROOMTONE_DATA    | `./data/roomtone.json` | Persistent room roles, setlist, chat, session, and metronome state. |
| ICE_SERVERS_JSON | public STUN entry | JSON array passed to RTCPeerConnection, including your TURN relay when needed. |
| ICE_TRANSPORT_POLICY | `all` | Use `relay` to require TURN for a relay-only test. |
| PUBLIC_ORIGIN | unset | Exact public HTTPS origin of a reverse proxy, without a trailing slash. |

Example for a service behind an HTTPS reverse proxy:

```dotenv
HOST=127.0.0.1
PORT=8787
MAX_PARTICIPANTS=8
ROOM_PASSWORD=
PUBLIC_ORIGIN=https://practice.example.com
ICE_TRANSPORT_POLICY=all
ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:relay.example.com:3478","username":"temporary-user","credential":"temporary-credential"}]
```

The browser must receive TURN credentials to connect. This app exposes its ICE configuration at `/config`; use bounded/short-lived relay credentials and rotate them. It does not provide a TURN credential minting service. The included `.env` must remain free of secrets. Configure real credentials in the host environment; never commit certificate keys or real credentials.

## Multiple computers and internet rooms

Only the host needs Node and the project files. Musicians open the host's reachable HTTPS address in their browsers. A `localhost` link always points back to the musician's own computer, so it cannot be used as the remote band's meeting link.

1. Run one reachable server for the band. Each player visits that server's address with the same room code.
2. Terminate valid HTTPS at a reverse proxy, or provide certificate/key paths for direct HTTPS. Plain HTTP on a LAN IP is insufficient for browser input permissions; localhost's development behavior does not extend to other computers.
3. Forward HTTP requests and WebSocket upgrades for `/signal`. Preserve the public Host header, or set `PUBLIC_ORIGIN` to the exact public HTTPS origin. HTTP APIs and WebSocket upgrades check request origins.
4. Configure a TURN service for networks that cannot connect directly. Open the relay service's required ports according to that provider's instructions. App hosting and TURN are separate services.
5. Configure the optional server password and distribute it to the band separately from the invite.
6. Validate with two different networks and real instruments before a rehearsal.

The source does not include a deployed domain, certificates, a TURN account, or an SFU. Use a single server instance: live signaling is held in memory and is not shared across replicas. Room state is stored in the data JSON file. Keep the Node process running with the host platform's service manager. Restarting disconnects everyone; persistent rooms and history remain.

## Data and recovery

The application stores no uploaded audio files on the server. Room roles, setlists, up to 200 chat/session events, and the current shared metronome state persist in `ROOMTONE_DATA`. Back up the file. No account is required; each browser creates a local random ID so its display name and room role can be remembered. Anyone with a room code can join, and a browser can alter its local ID, so do not use room roles as an identity/security boundary. Use HTTPS for any non-local use. A maximum of 500 retained live rooms bounds live server state. Local browser storage holds device and metronome preferences. The optional access password is held in session storage for the current browser session.

Back up `ROOMTONE_DATA`, the source, and `.env` separately. The data file is served only through application APIs; do not publish it in a public repository.

The server creates `data/roomtone.json` on its first persistent room change; its parent directory must be writable. To back up consistently, stop the server, copy the JSON file and `.env` to your backup location, then restart. To restore, stop the server, keep a copy of the current data, restore the saved JSON to the configured path, and restart. Room ownership and MD roles also depend on the browser keeping its local ID; restoring the server file alone does not recreate a cleared browser identity.

Chat and join/leave events share a bounded log: all writes retain up to 200 combined events. Room views return the latest 100. Audio files and recordings are not stored in this log.

## Routing DAW and VST audio

Roomtone's browser captures audio input devices and streams them as separate lanes. To send Kontakt, Logic Pro, FL Studio, Arturia, or another plugin's output, route the DAW master to an interface loopback input or OS virtual audio device, then select that input on a **Software instrument / DAW** lane. If the DAW should also reach local speakers/headphones, configure a multi-output or aggregate device in the operating system/interface. Virtual-device availability depends on the audio driver; Roomtone cannot capture arbitrary desktop playback without such a route.

The Web MIDI output menu can send a controller's MIDI events to a MIDI output port exposed by the browser. For virtual routing into a DAW, install/configure a virtual MIDI port and select it as a DAW input. Direct keyboard-to-DAW MIDI plus DAW audio loopback is often simpler, particularly where a driver locks a controller to one app.

Use this sequence before inviting the full band:

1. Load a sound in the DAW or standalone instrument host and play it with the MIDI keyboard.
2. Configure an interface loopback or virtual audio device to carry that host's output. Make sure it appears as a browser audio input.
3. Join Roomtone. Choose **Add instrument → Software instrument / DAW**, then **Microphone, interface, or DAW/VST output** and select that input.
4. Check the lane meter, then ask another musician to confirm the sound and its volume/mute controls.
5. If sending several parts independently, expose separate input endpoints and add separate lanes. A single captured DAW master remains one combined lane.

Do not include Roomtone's incoming band audio in the captured DAW loopback bus. Otherwise the band hears its own audio returned with a delay. Follow the [DAW/VST routing guide](DAW_ROUTING.md) for the signal path and troubleshooting.

## First rehearsal acceptance

Confirm that two musicians can join by name, exchange chat, and reopen the same shared setlist. Have the owner assign the other musician MD, then try a shared metronome start with count-in and a typed tempo change. Connect each audio or MIDI source individually and confirm its sound from the other computer.

For remote rehearsal, repeat on separate networks with the intended HTTPS/TURN configuration. Let clock checks run for several minutes and record the RTT/drift ranges. These estimates do not measure microphone-to-headphone or DAW-to-headphone latency; use the [hardware and timing checklist](TESTING.md) for that validation. Physical DAW/controller and separate-network acceptance remains to be performed with your equipment.

## Platform references

- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Secure-context restricted features](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts)
- [WebRTC negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)

## Preflight and diagnostics

Run `npm run doctor` after installing dependencies. It checks the Node version, required files, dependency availability, writable data directory, data JSON, and configuration. Run `npm run doctor -- --remote` for remote use: it additionally requires a configured TURN server with credentials and an HTTPS certificate pair or HTTPS `PUBLIC_ORIGIN` for your reverse proxy. These are configuration checks; they cannot prove a relay, certificate, proxy, or firewall works.

For a live relay test, set `ICE_TRANSPORT_POLICY=relay`, restart, reconnect two musicians, and send audio. **Room tools → Connection check** should show a connected peer with a `relay` path and increasing received packets. Then choose whether to retain relay-only mode or restore `all` for direct connections when available. Download reports from each side for comparison. The report omits TURN credentials.

Invalid persisted JSON stops startup instead of replacing your rooms with an empty store. Restore a known backup after investigating the error. A server restart retains setlists/roles/history but stops the old shared click; the owner or MD starts a new timeline. Run only one server against a data file.
