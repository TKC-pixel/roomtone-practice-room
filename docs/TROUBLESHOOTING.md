# Troubleshooting

| Symptom                                         | Action                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` or `npm` not found                       | Install Node 22.9+ and reopen the terminal.                                                                                                                    |
| PowerShell blocks npm.ps1                       | Use `npm.cmd ci` and `npm.cmd start`.                                                                                                                          |
| Missing `ws` package                            | Run `npm ci` in the folder containing package.json.                                                                                                            |
| EADDRINUSE / port busy                          | Stop the other Roomtone process, or set PORT=8788 in .env and restart.                                                                                         |
| Server configuration unavailable                | Use the new server's URL, not the old HTML file. Check `/health` and `/config`.                                                                                |
| Browser cannot use microphone/MIDI              | Open localhost for local development or valid HTTPS remotely. Check site permissions.                                                                          |
| Wrong microphone or interface input             | Reconnect the lane and choose its input device. The selection applies to that lane; use the interface's control panel for individual channels.                  |
| No MIDI devices                                 | Connect the controller before scanning, use a browser exposing Web MIDI, and allow MIDI permission.                                                            |
| Keyboard's real sound is missing                | MIDI conveys notes. Capture the keyboard's audio output through an interface for its own sounds.                                                               |
| Kontakt/Logic/FL Studio plugin is silent remotely | Route the DAW master to an interface loopback input or OS virtual audio device. Add a **Software instrument / DAW** lane and select that input. Check the browser meter and DAW output routing. |
| DAW audio is heard locally but not in Roomtone   | Roomtone cannot capture arbitrary desktop playback. Select an audio-input loopback/virtual cable endpoint, not the output device.                              |
| No DAW loopback input appears                    | Install/configure the interface's loopback driver or OS virtual audio device, then reload/allow microphone permissions and reconnect the lane.                  |
| Keyboard cannot feed both DAW and Roomtone MIDI | Some Windows MIDI drivers are exclusive. Connect the keyboard directly to the DAW and capture the DAW audio in Roomtone, or use a virtual MIDI port.           |
| Echo or feedback                                | Use headphones and remove duplicate captures of the same microphone.                                                                                           |
| Mic connected but you cannot hear yourself      | Microphones are not locally monitored. Use interface direct monitoring; have a bandmate check the signal.                                                      |
| No incoming sound                               | Resume room audio, raise the received LIVE fader, unmute it, and check output volume.                                                                          |
| MD mic stays silent                             | First click prepares the input; subsequent holds transmit. Check its M button and send fader.                                                                  |
| Audio works locally but fails over the internet | Verify HTTPS/WSS, proxy upgrade handling, and TURN relay configuration/credentials.                                                                            |
| Wrong access password                           | Enter the server's ROOM_PASSWORD in app Settings, save, and join again.                                                                                        |
| Shared metronome fails to start                 | Only the room owner or assigned MD can control it. Ensure every musician has joined, enabled audio by clicking in the page, and allowed the browser audio context. |
| Shared metronome seems out of time              | Compare the clock RTT/drift panel on each browser, retry with a longer count-in, keep the tab foregrounded, and measure the actual audio output separately.     |
| Chat or session history disappeared             | The server JSON data file stores shared chat/session history and setlists. Check `ROOMTONE_DATA`, write permissions, and the file backup.                        |
| My room role changed/reset                        | The app remembers role by a browser-local ID. Clearing site storage or changing browser creates a new identity; ask the room owner to assign MD again.           |
| Room is full                                    | Default cap is eight. Raising MAX_PARTICIPANTS needs load testing; it does not increase network capacity.                                                      |

After a server disconnect, rejoin and reconnect inputs manually. This avoids resuming a microphone transmission unexpectedly. Reload the page if a device was unplugged while actively capturing. If a selected device no longer exists, choose System default in Audio devices.

## Setup and connection reports

Run `npm run doctor` for local installation/configuration problems, or `npm run doctor -- --remote` for missing HTTPS/TURN configuration. Use **Room tools → Connection check → Download report** to save current peer RTT/jitter, received packet counts, path type, and browser input support. A report without a selected media path can simply mean nobody is sending audio yet. A configured TURN URL does not prove the relay is reachable.

A setlist conflict keeps your draft open: copy it before reopening the latest shared list and merging. If the server refuses to load room data, preserve the file and restore a valid backup; it is deliberately not silently reset. After a complete server/signaling disconnect, rejoin and reconnect your inputs.
