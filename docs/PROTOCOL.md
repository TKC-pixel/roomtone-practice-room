# Room signaling protocol

## HTTP

| Route                    | Response                        |
| ------------------------ | ------------------------------- |
| GET /                    | App HTML                        |
| GET /app.js, /styles.css, /metronome.js, /diagnostics.js | Public client assets            |
| GET /health              | `{ok, rooms, peers}`            |
| GET /config              | `{iceServers, iceTransportPolicy, maxParticipants}` |
| GET /api/rooms           | Rooms associated with browser ID |
| POST /api/rooms          | Create a room; creator browser is owner |
| GET /api/rooms/:id       | Room participants, setlist, and history |
| POST /api/rooms/:id/role | Owner assigns `member` or `md` using an opaque member ID |
| PUT /api/rooms/:id/setlist | Replace shared setlist |
| WebSocket /signal        | JSON room messages              |

Static files accept GET/HEAD only; API routes accept their documented methods. Other file paths return 404. WebSocket messages have a 128 KiB limit. A client must join within 15 seconds. Connections exceeding 150 messages within a one-second window are closed. `X-Roomtone-Client` identifies a browser for remembering its role; it is not an authenticated account. IDs must contain 8–80 letters, digits, underscores, or hyphens and cannot use reserved prototype names. Member listings return SHA-256 opaque IDs rather than the browser-local ID. Treat the local ID as private because it conveys room privileges. If `ROOM_PASSWORD` is set, HTTP APIs require `X-Roomtone-Access`; WebSocket join uses `password`. Request origins must match Host or the exact configured `PUBLIC_ORIGIN`.

## Client messages

```json
{"type":"join","clientId":"browser-local-id","name":"Jordan","instrument":"Keys","room":"room-id","password":"optional"}
{"type":"chat","text":"Ready for verse two"}
{"type":"signal","to":"peer-id","signal":{"description":{"type":"offer","sdp":"..."}}}
{"type":"signal","to":"peer-id","signal":{"candidate":{}}}
{"type":"stream-meta","streamId":"browser-stream-id","label":"Jordan · Keys","kind":"Keys"}
{"type":"stream-remove","streamId":"browser-stream-id"}
{"type":"clock","clientAt":1730000000000}
{"type":"clock-report","rtt":25,"offset":-4,"driftPpm":0,"driftReady":false}
{"type":"metro-start","bpm":112,"beats":4,"accent":true,"countInBars":1}
{"type":"metro-tempo","bpm":120,"beats":4,"accent":true,"countInBars":0}
{"type":"metro-stop"}
```

The client supplies a display name and browser-local ID. Anyone can join a room code; the first browser becomes owner. Only the owner or MD can control the shared metronome. `signal.to` must refer to a peer in the same room. Chat is truncated to 1,000 characters. Room codes and stream labels are bounded. A peer may register up to 32 stream labels.

## Server messages

- `joined`: assigned `peerId`, `room`, role, existing `peers`, recent `history`, setlist, metronome state, clock metrics, and current `streams`.
- `peer-joined`: `peerId`, `name`, `instrument`.
- `peer-left`: `peerId`, `name`.
- `chat`: `peerId`, `name`, `text`, Unix-millisecond `at` timestamp.
- `signal`: server-assigned `from` and the forwarded `signal` object.
- `stream-meta`: `peerId`, `streamId`, `label`, `kind`.
- `stream-remove`: `peerId`, `streamId`.
- `clock`: echoes `clientAt` and includes server timestamp `serverAt`.
- `sync-metrics`: per-peer RTT, clock offset, and drift estimate.
- `metro-state`: shared running state, tempo, meter, count-in, and future effective timestamp.
- `setlist`: revised shared setlist `items` and `revision`.
- `role`: updated room role for the affected browser ID.
- `error`: human-readable `message`.

Disconnecting the WebSocket leaves the live room. Chat/session history and room data persist in `ROOMTONE_DATA`; active streams and timing reports are removed with the peer. The protocol carries no raw MIDI or audio: browsers generate/transmit audio over WebRTC.

## Setlist concurrency

`GET /api/rooms/:id` returns `setlistRevision`. Submit `PUT /api/rooms/:id/setlist` with `{ "items": ["Song one"], "revision": 0 }`, using the revision you read. A changed revision returns HTTP 409 without changing the stored list. A successful response contains the new `items` and `revision`. Omitting the revision retains legacy unconditional replacement behavior; the bundled client always supplies it.
