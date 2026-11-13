# Validation and acceptance

## Automated checks

Run `npm run check` for server/client syntax and `npm test` for isolated integration checks on an ephemeral local port. Tests start and terminate their own server, do not open your microphone, and do not require a MIDI device.

Coverage: public assets, blocked non-public files, name-based room creation, owner/MD role checks, shared setlists and metronome state, wrong-password denial, same-room roster, stream-label replay to late joiners, recent chat history, direct signaling, cross-room signaling isolation, capacity rejection, stream removal, peer departure, and MD gain gating during fader changes.

Metronome checks cover audio-clock cadence, accents at bar boundaries, tempo changes, parameter bounds, cancellation on Stop, and recovery without a burst of missed clicks after timer throttling. Browser checks verified 120 BPM, three beats per bar, start/stop, and persisted settings after reload.

## Browser acceptance

The local browser acceptance run verified two participants, backing-file streaming, a received audio track with a nonzero measured signal, its mute control, correct labeling after a receiver rejoin, and setlist saving. This used a generated low-level tone and did not require microphone permission. Physical microphones, MIDI hardware, and internet TURN paths still require the hardware acceptance pass below.

1. Start the app. Open two tabs with different display names and the same test room code. Confirm both participant counts and bidirectional chat.
2. In one tab, load a short audio file and play. Confirm a new LIVE backing-track lane on the other tab, actual sound, pause, seek, and independent receiving volume/mute.
3. Join a third tab after the source starts. Confirm the proper stream label and audio.
4. Leave/rejoin the sender. Load/play again and verify that backing routing still works.
5. Save a setlist from one participant and reopen it from another. Verify shared join/leave history. On the owner browser, promote a musician to MD and confirm they can start/change the shared metronome while a regular member cannot.

## Hardware acceptance

Use two computers and headphones to avoid feedback. This checklist requires your equipment and browser permissions.

- Select a microphone/interface, add a channel, and confirm a remote listener hears it. Test send fader and mute.
- Choose a second device and add another channel; confirm independent levels remotely.
- Prepare the MD microphone. Confirm silence while idle, including while moving its fader; hold to transmit, release to stop. Repeat with Space/Enter, blur, and tab switching.
- Connect a MIDI controller. Test simultaneous notes, velocity, releases, drums, local monitoring, reassignment, mute, and removal. Check for hanging notes.
- Load a software instrument in Kontakt, Logic, FL Studio, Arturia, or another DAW. Route its output to an audio-interface loopback or system virtual input, select that device on a **Software instrument / DAW** lane, and confirm remote sound, meter activity, volume, and mute. Check that the DAW remains audible locally if desired.
- Test removing a live channel, leaving a room, and disconnecting the server: no microphone should continue transmitting into the room.
- Test with at least two musicians on separate networks and your production TURN configuration. Compare each browser's server RTT and clock-drift estimate for several minutes while repeatedly starting/stopping the shared count-in and changing tempo. Record the range over 10-minute sessions. Use an audio loopback recording or metronome-click capture to measure actual sound-onset alignment and microphone-to-headphone delay; browser clock metrics alone do not capture device or WebRTC playout latency.

No automated check proves compatibility with every interface, controller, DAW, plugin, browser, or network. The application supplies selectable browser audio inputs and MIDI routes; the deployment owner should record supported hardware/network combinations and measured timing results after completing this acceptance pass. Physical multi-network testing was not performed in this development environment.

## Version 1.2.0 readiness checks

The automated suite includes persistence across a server restart, corrupt-data startup failure without overwriting the file, malformed/reserved identity rejection, HTTP password/origin checks, opaque member identifiers, stale setlist conflict rejection, shared metronome phase after throttling, continuous old tempo until a future change, and equal wall-clock beats from different simulated AudioContext origins.

A two-client local browser check verified shared start and 120→108 BPM propagation, member timing controls disabled, independent member click muting, owner promotion of the second browser to MD with controls enabled, the connection-report dialog, and leaving the room. No physical audio input was opened during this check. Local clock figures do not establish internet performance.

Run `npm run doctor`, `npm run check`, and `npm test` before release. Run `npm run doctor -- --remote` once hosting/TURN values exist. During physical acceptance also unplug an active input/controller, cancel input selection, change click volume while locally muted, and interrupt/recover the network. Verify all-notes-off on an external MIDI route and reconnect sources explicitly after a signaling disconnect.
