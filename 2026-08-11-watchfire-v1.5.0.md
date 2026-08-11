# WATCHFIRE v1.5.0: the roadmap is empty and I still have not plugged in a radio

*Gears of Resistance, 11 August 2026*

Station 11 is the last one. LOGBOOK records the session, lets you annotate it
while it is happening, replays a capture back through the same reader, and
exports one bundle carrying everything the other ten stations know.

All twelve stations are built. Sixty five assertions, all green. And the sentence
I have ended five posts with is still true, so I am going to make it the headline
this time instead of the footnote.

## The bug that was waiting in the replay

The capture format and the replay transport have been sitting in this file since
v1.0, doing nothing. Both looked finished. Neither had ever been run end to end.

So I wrote the obvious test: record a full session against the simulator, then
feed that capture into a fresh session that has never seen a radio, and check it
rebuilds the same roster and the same config.

It did not. It sat in handshake forever.

The reason is one of those things that is obvious the second you see it. On
connect, the session sends a wake run, then asks for the config, and as part of
asking it clears the roster, the channels and the config, because a fresh config
burst is about to replace them. Perfectly correct behaviour against a radio.

Against a recording it is a disaster. The recording had already delivered
everything during the connect call, and then the session wiped all of it and sat
waiting for a config burst that had already gone past and was never coming again.

A replay is now a genuinely one way session: no wake run, no config request, no
heartbeat, and it never clears what the stream has already told it. And because
the failure mode of a recording without a complete config burst is now a real
possibility, it reports that plainly rather than sitting in handshake looking
busy.

The general lesson, which I keep relearning in different costumes: **code that has
never been run end to end is not finished, it is only written.** Both halves of
this had unit-level plausibility for five releases. Ten minutes of actually
connecting them found the defect immediately.

## Notes you disagreed with are still part of what happened

You can take notes in LOGBOOK while you work. They are timestamped and they go in
the bundle.

You cannot delete one. You can strike it, and the struck note stays in the record
and in the export, marked as struck.

That is not me being awkward about a delete button. If at 14:02 you wrote "resync
burst at the top of the hour" and at 14:09 you wrote "spoke too soon, that was the
simulator", the first note is not a mistake to be tidied away. It is the record of
what you believed at 14:02, which is exactly the sort of thing you want six months
later when you are trying to work out why you went down a particular path. A log
you can quietly edit is not a log.

## Saying the uncomfortable thing on the button

The recorder captures every byte in both directions. Which means if you write a
channel or a codeplug while it is running, your capture contains the channel key
and the admin session passkey in the clear.

That warning is not in the README where nobody will read it. It is in a red box
directly under the record button, and the raw capture is unticked by default in
the bundle export, and the sections that carry key material are labelled as such
right next to their checkbox.

Attaching a capture to a bug report is a completely reasonable thing to want to
do, and it is a completely reasonable way to publish your keys. The instrument's
job is to make sure that if you do it, you did it deliberately.

## A bundle you cannot read later is not evidence

The bundle is one JSON file. Roster, codeplug, channels, packet log, telemetry,
topology, traceroutes, notes, optionally the raw capture.

Every section carries a note saying what it claims. At the top there is a short
"reading this later" block: this is what one radio heard during one session and
not a survey of the mesh, anything about links is observed rather than
authoritative, telemetry timestamps are reading times and not arrival times, and
if `simulated` is true then none of this came from a physical radio.

I have opened enough of my own exports from three years ago to know that the data
is the easy part. What goes missing is the context: what was I measuring, what did
the tool actually mean by that field, and how much should I trust it. A bundle
that carries the data and drops the caveats has kept the cheap half.

There is also a printable summary, rendered into a print only region of the same
page. No new window, no generator service, no PDF library. Print stylesheet, page
margins, done.

## So what is actually finished here

Twelve stations. A hand rolled protobuf codec that never drops a field it does not
understand and refuses to write back anything it could not fully read. A resyncing
framer that treats firmware log text as a first class view instead of noise. A QR
encoder, an airtime calculator checked to the microsecond against an independent
implementation, charts that break where the evidence breaks, a topology graph
where every edge names its own source, a position plot that draws a privacy
setting as the box it actually is, and now a recorder.

One HTML file. No server, no build step, no network, no dependencies. GPL-3.0.

## And what is not

**Not one byte of this has come off a real radio.**

Everything has been exercised against a simulator I wrote, which means everything
has been exercised against my own reading of the protocol. Where I have read
firmware source I have transcribed it carefully and cited the file and the date.
Where my reading is wrong, my simulator is wrong in exactly the same direction and
agrees with me enthusiastically, and sixty five green assertions will not save me,
because they are testing that I built what I intended to build.

The specific things I most expect to be wrong on first contact, in order:

1. Whether real firmware populates `Telemetry.time`, or leaves it zero and makes
   station 08 draw the backlog wall the whole design avoids.
2. Whether `precision_bits` is actually sent, or whether BEARING will mostly show
   "not stated".
3. Timing. The 300 second heartbeat is transcribed and scheduled and has never
   kept a real client alive for 300 seconds.
4. What a physical unplug does to the transport, since reconnect with backoff is
   not implemented.

That list is in the README under Known Limitations, where it belongs.

If you have a Meshtastic radio and twenty minutes, I would rather have your first
contact report than almost anything else. Point it at the thing, watch station 01,
and tell me what the lane actually looks like.

Make. Hack. Learn. Share. Repeat.
