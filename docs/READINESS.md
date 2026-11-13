# Release readiness — 1.2.0

The software is prepared for a local rehearsal acceptance test. Internet rehearsal still needs an actual HTTPS host and TURN relay configured; neither is provisioned by the project.

## Completed

- Quick name-and-room joining, with no account service.
- Per-source send levels and personal receiver mixing, vocal input and MD talkback.
- Browser MIDI synth and external MIDI output routes; selectable DAW/interface/loopback audio input. Native plugins run in the musician's own host, not inside this web app.
- Shared click start, count-in and tempo changes. Old tempo continues until the announced transition; throttled clients resume the common beat phase.
- Owner/MD controls and shared persistent setlists, including detection of conflicting edits.
- Source cleanup for late permission results, canceled input selection, device disconnects and room exit; ICE restart attempts for failed media connections.
- Downloadable connection report and local/remote configuration preflight.
- Corrupt-data startup rejection, opaque member IDs in room listings, optional password checks on HTTP APIs and WebSocket join.
- Updated setup guide, user manual, protocol, architecture and testing documentation. Public-safe `.env` defaults and GitHub CI workflow included.

## Verification

Run `npm run doctor`, `npm run check` and `npm test`. Automated tests cover signaling/rooms, persistence/restart, setlist conflicts, request validation, MD gain gating and metronome scheduling with simulated audio clocks. The local browser check used two separate identities and verified shared timing propagation, click mute, role promotion and connection reporting.

These checks do not establish audible instrument quality or internet latency. The GitHub workflow runs on Node 22 and 24 after publication; its remote result has not yet been observed.

## Deployment still to configure

1. A reachable HTTPS address, valid certificate or TLS reverse proxy, and forwarding of `/signal` WebSocket upgrades.
2. A working TURN relay and credentials supplied through the host environment. Use `npm run doctor -- --remote`, then exercise a relay-only media connection.
3. A single persistent server process, writable room-data storage and backups.

The supplied defaults intentionally listen on localhost and contain no credentials. The remote configuration check reports missing HTTPS/TURN until configured.

## Later equipment acceptance

Use the checklist in [TESTING.md](TESTING.md) with your microphones, controllers, DAWs and audio interfaces. Confirm loopback routing, independent levels, MD push-to-talk, controller unplug/reconnect and recovery after network loss. Measure actual microphone-to-headphone delay and click alignment on separate networks. Room RTT/drift estimates and simulated clock tests do not substitute for these measurements.

The default cap is eight musicians; that is a configuration limit, not a measured capacity guarantee. The current peer mesh requires a separate media-server design if larger groups exceed available bandwidth or processing.
