# Roomtone

**Live rehearsal preview:** [Open Roomtone](https://roomtone-practice-room.onrender.com/). Hosted on Render's Free plan; it may take about a minute to wake, and server-stored rooms/setlists/history can reset when the instance restarts. See [hosting details](docs/RENDER.md).

A browser music rehearsal room with live peer audio, per-source mixing, MIDI instruments, DAW/VST audio capture, vocal microphones, MD talkback, room chat, shared backing tracks, synchronized metronome, lightweight room roles, shared setlists, and session history.

## First-time local setup

1. Install **Node.js 22.9 or newer** (Node 24 is suitable). Confirm `node --version` and `npm --version` in a new terminal.
2. Extract the ZIP if needed, then open a terminal in the folder containing this README and `package.json`. The archive contains the project files directly. Do not open `public/index.html` directly.
3. Install the locked dependencies:

   ```sh
   npm ci
   ```

4. A public-safe `.env` with local defaults is included. To reset it, copy `.env.example` to `.env`. Preserve your existing `.env` when updating. No account service or password is required with the defaults. Keep real passwords, TURN credentials, and private keys outside the committed files; use environment variables on your host.

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS / Linux:

   ```sh
   cp .env.example .env
   ```

5. Check setup with `npm run doctor`, then start the server:

   ```sh
   npm start
   ```

6. Open **http://localhost:8787/** in a desktop browser such as Chrome or Edge. Click **Join room**, type the name your band should see, select an instrument, and enter the room code.
7. The first person to use a room code becomes its owner. Share the same link/code with the band; they just enter their names. The owner can choose **Room tools → Room musicians / MD role** to assign an MD on another browser.
8. Use headphones. Allow microphone permission and connect a separate lane for each instrument, vocalist, interface, or DAW/VST loopback input. For MIDI, use **Connect MIDI** and choose a built-in synth or an available MIDI output.
9. Stop the server with **Ctrl+C**. Start it again with `npm start` next time; installation is only needed initially or after dependency changes.

On this computer, the project folder is `C:\Users\TrinityC\Documents\Codex\2026-11-13\ca\outputs\roomtone`.

## Quick rehearsal

- **Metronome** provides 30–300 BPM, tap tempo, 1–12 beats per bar, an optional first-beat accent, click volume, and 0/1/2/4-bar count-in. The room owner or MD schedules the same downbeat and tempo changes for all room members. Other members follow the shared timeline and can mute their own click. When no shared click is running, they can start a local click. Clock RTT and drift estimates appear below the metronome after participants join.

- Click an instrument name to choose an audio input for that lane, or use **Add instrument** to create another lane. Each lane has its own send volume and mute.
- For Kontakt, Logic, FL Studio, Arturia, or another VST/plugin host, route the DAW's audio output to an audio-interface input or a system loopback/virtual audio device, then add that device as a **Software instrument / DAW** audio lane. Web MIDI output routing is available too when a DAW-visible MIDI port is installed.
- Use **Your vocalist mic** for a live vocal channel. Click it again to disconnect.
- Click the **MD mic** once to prepare it, then hold its button (or Space/Enter while focused) to talk. Release to close the cue channel.
- Local send faders change what the band receives. Channels marked **LIVE** change only your listening mix. **Pause room audio** silences incoming streams while your sources continue sending.
- **Load audio** selects a local backing file. Play/pause and click its progress bar to seek; room members hear it as a separate channel.
- Send messages in Room chat. Room tools includes shared setlists, shared session history, room creation, and MD role management. Use the arrow button in the header to copy the room link.

## Documentation

- [Free Render deployment](docs/RENDER.md) — host the app from GitHub, with free-tier storage and audio-connectivity limits.
- [User manual](USER_MANUAL.md) — every main control and a rehearsal walkthrough.
- [Project setup and deployment](docs/SETUP.md) — installation commands, first room, DAW audio setup, HTTPS/TURN, backups, and first rehearsal checks.
- [DAW/VST audio routing](docs/DAW_ROUTING.md) — get Kontakt, Logic, FL Studio, and other software instrument output into Roomtone.
- [Architecture](docs/ARCHITECTURE.md) — audio flow, state, source layout, and operating limits.
- [Signaling protocol](docs/PROTOCOL.md) — HTTP routes and WebSocket messages.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — input, MIDI, audio, startup, and network problems.
- [Release readiness](docs/READINESS.md) — completed checks and remaining deployment/hardware acceptance.
- [Publish to GitHub](docs/PUBLISHING.md) — commands from this project folder to create a public repository.
- [Validation](docs/TESTING.md) — automated checks and a real-device acceptance checklist.

## Checks

```sh
npm run doctor
npm run check
npm test
```

The tests cover name-based room joining, owner/MD controls, shared setlists, shared metronome state, room isolation, access passwords, capacity, stream metadata, signaling, chat history, and MD talkback gating. Persistence/restart behavior, malformed requests, stale setlist conflicts, shared click phase, and future tempo transitions are also tested. Hardware and multi-network timing acceptance steps are documented separately. Use **Room tools → Connection check** for a downloadable live diagnostic report. Run `npm run doctor -- --remote` before deploying remotely; this validates configuration, not network reachability.

## Scope

The default limit is eight participants using peer-to-peer audio. That limit is a guardrail, not a tested performance guarantee for every network. Many instrument lanes are supported, but more sources and peers require more bandwidth and processing. The metronome aligns browser audio clocks using server timestamps and scheduled starts; network audio itself still has latency, so this is not a promise of zero-delay ensemble playback.

Remote musicians need the same reachable **HTTPS** site and an appropriate **TURN** configuration. Localhost refers to each person's own computer, so a localhost invite is not an internet meeting link. This project does not provision hosting or a TURN service.

The application is an audio rehearsal room, not a video broadcasting service. Room roles, setlists, session events, and chat are stored in `data/roomtone.json` on the server. No account or sign-in is required; a browser-local random ID remembers its room role. Room links are open to anyone who has the code, and roles provide rehearsal controls rather than strong identity security. Use HTTPS outside localhost. There is no recording service or distributed media server. Network delay affects live audio; the timing panel estimates server-clock RTT/drift but cannot measure acoustic output delay without a physical loopback test.

Recent chat and join/leave activity persist on the server in a shared bounded log. The log retains up to 200 combined events; room views return the latest 100. Empty live-room connections expire after one hour; room records remain. Device preferences, display name, and metronome settings stay in each browser. Backing files are selected locally and streamed as audio, not uploaded to server storage.
