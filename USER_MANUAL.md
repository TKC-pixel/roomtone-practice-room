# Roomtone user manual

**Hosted rehearsal preview:** open [Roomtone](https://roomtone-practice-room.onrender.com/), choose **Join room**, and enter your name and the band's room code. Share this HTTPS link with musicians; they do not need to install Node or create accounts. The free host can take about a minute to wake and can lose server-stored setlists, history and room roles on restart. Keep copies of important setlists. TURN relay setup and real instrument/network acceptance are still outstanding; see [hosting details](docs/RENDER.md).

Roomtone is a name-and-room-code rehearsal app. You do not need an account, email address, or sign-in. For installation, use the [project setup guide](docs/SETUP.md); for software instruments, use the [DAW routing guide](docs/DAW_ROUTING.md).

## First rehearsal checklist

1. Start Roomtone and open the server address in your browser.
2. Join with your display name, instrument, and the band's room code.
3. Connect headphones. Add one audio input or MIDI route at a time.
4. Ask another musician to confirm the sound, then check each lane's volume and mute.
5. Open **Room tools → Shared setlists** to enter the rehearsal order.
6. Have the owner or MD set the tempo, meter, and count-in, then start the shared click.

## 1. Prepare your equipment

Use headphones to prevent speaker sound returning through microphones. Connect your MIDI controller by USB or a MIDI interface. For a guitar, bass, acoustic instrument, external keyboard sound, or microphone, use an audio interface or an available microphone input.

A MIDI cable sends note/control messages, not recorded sound. Roomtone includes a basic built-in synth and can route MIDI to an external MIDI output. For an external instrument's sound to reach other musicians, connect its audio output to a selected audio-interface input and publish that input as an audio lane.

Start the application using the [README](README.md). Microphone and MIDI permissions are controlled by your browser. Use the server URL rather than opening the HTML file from disk.

## 2. Join and invite

1. Click **Join room** and enter the name you want the room to display.
2. Choose an instrument and enter a room code. The first browser to join a new code becomes its owner.
3. Other musicians open the same server link, choose their own display names, and enter the same room code. No accounts or sign-up are required.
4. The owner can open **Room tools → Room musicians / MD role** and promote a musician's browser to MD. Use the arrow button to copy the room link.

If the server operator configured a password, open **Room tools (☰) → Settings**, enter it, save, and join again. This is a server-wide entry password. Otherwise, anyone who has the room code can join; roles are for convenient rehearsal control, not verified identity.

To create a room with a generated code, open **Room tools → My rooms / create room**, enter a room name, and choose **Create room**. Leave your current room before switching. Roles are remembered in the same browser; changing browsers or clearing site storage gives you a new browser identity. Reusing someone's display name does not restore their role.

The owner and MD can control the room metronome. Other musicians can send audio, chat, edit the shared setlist, and control their own listening mix. The MD microphone is a separate push-to-talk audio channel; its label does not grant the MD role.

## 3. Choose an audio device

Open **Room tools → Audio devices** and permit input access to see readable device names. The saved default applies to channels that use the system default. When multiple audio inputs are available, connecting an instrument lane prompts for its own interface input.

Each channel requests a browser input stream. Device selection chooses an input endpoint; selecting individual channels within a multichannel interface depends on that interface and OS driver. Connecting the same microphone to several lanes duplicates its sound.

Audio capture disables automatic gain, noise suppression, and echo cancellation to preserve instruments. This makes headphones particularly important. Your interface controls the physical input gain; application faders control the digital send level.

## 4. Send an instrument or voice

Click an instrument name in the mixer to connect the selected microphone/interface. Alternatively, click **Add instrument**, choose a part, and select **Microphone, interface, or DAW/VST output**. Join a room before connecting.

For vocals, click the microphone control in **Your vocalist mic**. It creates a Lead vocals lane. Its **LIVE** status means the input is being sent. Click the card control again to disconnect it. The lane's fader controls the send level; M mutes it. Removing a connected local lane stops its capture and transmission.

Roomtone does not play your microphone back to you. Use your interface's direct monitoring when available.

## 5. Play MIDI

1. Join a room and connect the hardware controller.
2. Click **Connect MIDI** and allow permission.
3. Select a controller, a lane, and either built-in synthesis or an external MIDI output.
4. Built-in synth audio is streamed to room members. For an external synth, connect its audio output to an interface input and publish that input as another audio lane.
5. Adjust each lane's send fader or M button. You can connect separate controllers to separate lanes.

One controller is assigned to one lane at a time. Reassigning it stops the old route. To add another instrument, add a MIDI lane and connect a controller to it. Drums/percussion use synthesized kick and noise-based percussion; other categories use basic oscillator timbres.

## 5.1 Use a DAW or VST instrument

Roomtone sends audio from browser input devices. It does not load Kontakt, Logic Pro, FL Studio, or other plugins inside the browser. Run the plugin in your DAW, then route the DAW's audio output into a selectable browser input:

1. In the DAW or standalone instrument host, load the instrument and confirm the MIDI keyboard plays it locally. This applies to Kontakt, Logic Pro, FL Studio, Arturia V Collection, and other hosts that can output to your chosen audio device.
2. Route the DAW master output to an audio-interface input/loopback channel or an operating-system virtual audio device.
3. In Roomtone, click **Add instrument**, choose **Software instrument / DAW**, choose **Microphone, interface, or DAW/VST output**, then select that input device.
4. Play a note and check the Roomtone input meter and a remote listener's audio. Set the DAW master and Roomtone lane send levels to avoid clipping.

On Windows, an interface's loopback input or a virtual cable such as VB-CABLE can route DAW output to an input. On macOS, use an interface loopback or a virtual device such as BlackHole; an aggregate/multi-output setup may be needed to hear locally at the same time. On Linux, use the monitor input for the audio sink that plays the DAW. Device names and routing vary by driver. The device must appear in the browser's audio input list.

You can also select an external MIDI output in **Connect MIDI** if your system exposes a virtual MIDI port that the DAW can receive. Many musicians instead connect the keyboard directly to the DAW and only use Roomtone to capture the DAW's audio. Some Windows drivers allow only one application to own a MIDI keyboard; in that case, connect the keyboard directly to the DAW.

For independent mixing of several software instruments, route each part to a separate input endpoint that the browser can select, then create one Roomtone lane per endpoint. Capturing one DAW master mix gives the band one combined lane. Keep Roomtone's received audio out of the captured loopback bus to avoid sending the band its own sound back.

## 6. Use the MD cue microphone

Click the MD button once to acquire the selected input and prepare the channel. Then press and hold the button to talk; release it to close the channel. Keyboard users can focus it and hold Space or Enter. The indicator shows **TRANSMITTING** only while held. Changing its fader while idle keeps the cue closed. Losing focus or hiding the tab also closes the cue.

The MD lane has its own send level and mute. The band receives it separately and can set its listening level independently. The owner can assign an MD role for room-synchronized metronome control; this role does not automatically duck other instruments.

## 7. Build your mix

Local instrument rows are **send channels**: their controls affect audio you transmit. Received rows show **LIVE** and the sending musician/part: their faders affect only what you hear. M toggles mute. The received row's × control also toggles its listening mute so you can restore it.

**Mixer** shows send and received channels. **Tracks** hides received channels to focus on your sends. **Pause room audio** mutes incoming sound without interrupting your outgoing instruments. Input meters show measured signal activity where an analyser is attached; they are not a calibrated loudness measurement.

## 8. Share a backing track

Click **Load audio**, choose a browser-supported local audio file, and press Play. Pause stops the file; clicking the progress bar seeks. The file's audio is transmitted as its own channel while you are in the room. The file remains on your device. Listeners receive the live stream with network delay; this is not a sample-accurate synchronized local-file player.

Replacing a backing file stops the previous outgoing backing stream. Leaving the room stops transmission. Local playback may continue, so pause it if desired. Reloading the page requires selecting the file again.

## 9. Metronome

Use the Metronome panel below the backing player for a click. Enter a tempo from **30–300 BPM**, drag the tempo slider, or use the −/+ buttons. **Tap tempo** estimates the tempo from repeated taps; a pause longer than 2.2 seconds starts a new tap sequence.

Choose **1–12 beats per bar**, toggle **Accent first beat**, choose no count-in or 1/2/4 bars, and set click volume independently. The room owner or MD presses **Start metronome** to schedule a shared count-in and downbeat; all joined members schedule their click against a server time estimate. Tempo changes from the owner/MD are broadcast; the current click continues until the scheduled transition to beat one at the new tempo. During a shared click, regular members use **Mute my click / Unmute my click** without changing the band’s timeline. When the shared click is stopped, a member may start a local click. The numbered indicators follow the local audio clock. Volume zero leaves the visual beat running.

Local preferences are remembered on this browser. Joining a room whose shared metronome is already running applies its current transport state, subject to browser audio permission. Click volume is local to your headphones; the click is not streamed as audio. The sync line reports server round-trip time (RTT) and browser clock drift estimates; drift estimates begin after about 30 seconds. These values do not measure sound-output delay at the headphones. The shared metronome does not start backing-track playback or compensate WebRTC audio latency. Leaving stops your click; the shared transport stops when the last musician leaves.

## 10. Chat, setlists, and sessions

Type a message and press Send. Messages are shared within the current room, with a 1,000-character limit. Chat and join/leave events persist on the server. The app reads the latest 100 combined events, so the visible chat can contain fewer than 100 messages. This is a recent activity log, not a recording or permanent archive of every rehearsal.

Use **Room tools → Shared setlists** to save up to 100 songs or notes, one per line. Room members see the same list. **Session history** displays shared join/leave events and persists on the server. Chat is also stored for late joiners.

Save a shared setlist while joined. Before joining, the setlist dialog saves a draft only in that browser. A save replaces the room’s list. If another musician saved after you opened it, Roomtone rejects the stale save and keeps your draft visible. Copy the draft, reopen the dialog to load the latest version, then merge and save. A network/save error also keeps the dialog and draft open. Session history also retains recent joins from your browser; the room activity entries require joining the room.

## 11. End a rehearsal

Click **Leave room** and confirm. Your outgoing streams and input tracks stop, peers disconnect, and MIDI handlers are detached. You may join again; reconnect microphones and MIDI when ready. Roomtone attempts to recover a failed media connection while signaling remains connected. If the server/signaling connection fails, the app disconnects and closes inputs; rejoin manually once service returns. Unplugging an input removes its active source; reconnect and select it again when ready.

For a lost device, silent stream, or remote connection failure, use the [troubleshooting guide](docs/TROUBLESHOOTING.md).

## Connection reports

Open **Room tools → Connection check** before or during rehearsal. It shows browser input support, audio state, available input labels, whether TURN is configured, clock estimates, and active peer statistics. Inputs are listed without opening a microphone. Hidden device labels become available after you grant input permission. **Download report** saves JSON locally; nothing is uploaded. Reports contain musician names and device labels, so review them before sharing. An empty media path before anyone sends audio is normal. RTT and jitter are network measurements, not microphone-to-headphone latency.
