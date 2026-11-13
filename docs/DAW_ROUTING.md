# Routing Kontakt, Logic, FL Studio, and other software instruments

Roomtone does not host VST/AU plugins inside the browser. Run the instrument in its normal DAW or plugin host, then send the DAW's audio output into Roomtone through an audio input device. Roomtone publishes that audio as a mixer lane, so it gets its own send volume and mute control.

## The audio path

```text
MIDI keyboard → DAW instrument (Kontakt / Logic / FL Studio / etc.)
              → interface loopback or OS virtual audio device
              → Roomtone “Software instrument / DAW” lane
              → other musicians
```

## Setup

1. Connect the keyboard to the DAW and confirm the plugin produces sound locally. Most musicians should leave the keyboard connected directly to the DAW.
2. In the DAW audio settings, choose an output that Roomtone can also select as an input. Good options are an audio interface's loopback channels or a virtual audio cable/device supplied by the OS or installed separately.
3. If you need to hear the DAW locally while capturing it, configure a multi-output or aggregate device that sends the DAW to both headphones and the loopback input. An interface's built-in loopback is usually the simplest setup.
4. In Roomtone, join the room and choose **Add instrument → Software instrument / DAW → Microphone, interface, or DAW/VST output**.
5. Select the interface loopback or virtual input. Play a note and confirm that the lane meter moves and another musician hears the plugin.
6. Set the DAW master and Roomtone lane fader so the remote signal is clear and not clipping. Use headphones or the interface's direct monitoring to avoid acoustic feedback.

## MIDI choices

Roomtone's **Connect MIDI** control can forward notes to an external MIDI output shown by the browser. For a DAW to receive those notes, the computer must expose a virtual MIDI port that is selected as a DAW input. This can be useful when the browser owns the controller. A DAW may instead connect directly to the keyboard; in that case, Roomtone only needs to capture the DAW audio output.

Some Windows MIDI drivers allow only one application to use a controller at a time. If either Roomtone or the DAW cannot see the keyboard, connect it directly to the DAW and use audio loopback for Roomtone. Mac and Linux virtual MIDI/audio routing also depends on the selected driver and device configuration.

## Troubleshooting

- **The DAW sounds locally, but the Roomtone meter stays still:** select a loopback/virtual audio *input*. A normal speaker or headphone *output* is not an input.
- **The loopback device is missing:** configure the interface driver or install a suitable system virtual audio device, then reload Roomtone and grant audio-input permission.
- **The remote signal clips:** lower the DAW master or interface loopback level first, then adjust the Roomtone lane send fader.
- **The DAW becomes silent locally:** its output may have been switched exclusively to a virtual cable. Configure an aggregate/multi-output destination or use interface loopback.
- **You hear echo:** avoid sending speakers into a microphone. Use headphones and disable duplicate audio routes.
- **The remote sound arrives late:** the stream includes capture, encoding, network, and playout delay. The clock sync panel measures clock timing; it does not remove audio transport delay.
