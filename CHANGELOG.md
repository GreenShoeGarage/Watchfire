# WATCHFIRE changelog

All notable changes to this instrument. Versions follow the house rule: build to
a working stop, then stop for review.

## v1.7.0 (2026-08-11)

Bluetooth. Confirmed working against the Pager from a file:// page.

### Built
- **BleTransport.** Connects to a Meshtastic radio over Bluetooth Low Energy
  behind the same transport interface as the serial link, so all twelve stations
  work over it unchanged.
- **A simulated GATT device**, driven by the same synthetic radio in unframed
  mode, so the bluetooth path is exercised without hardware.
- Station 01 gains a bluetooth button, and replaces THE WIRE over bluetooth with
  GATT counters, saying plainly that this transport has no lane to watch.

### Engineering
- The session now knows whether a transport is framed. A framed one delivers a
  byte lane to reassemble; an unframed one delivers whole messages straight to
  the frame handler. No synthetic headers are manufactured to keep the deframer
  busy, and an assertion checks it never sees a byte over bluetooth.
- No wake run over bluetooth. Those 32 bytes exist to make a sleeping serial
  device hunt for a frame header, and there is no header here.
- FromRadio is polled until empty and never subscribed to, per an explicit
  firmware warning that notify on it is not backwards compatible.
- The debug lane arrives on the log characteristic, tried as a LogRecord
  protobuf first and falling back to plain text, because that characteristic has
  been reused across firmware generations.
- Every GATT operation goes through one lane, since Chrome rejects concurrent
  ones. The serial wire gets that property for free.
- Bluetooth keepalive at 15 s rather than 300 s, after an idle Pager dropped a
  healthy connection 35.8 s after connect.
- A radio that accepts a connection and then drops it is reported as a pairing
  failure with what to do about it, rather than as a dead radio.
- 71 assertions, all green.

### Known
- Reconnect is still manual, which bites harder over bluetooth than over serial.
- Pair the radio at the operating system level first. The browser has no way to
  enter the passkey the radio displays.

## v1.6.0 (2026-08-11)

First contact with a physical radio, and the schema work it produced.

### The session
A LILYGO T-Lora Pager, ESP32, 915 MHz, connected over Web Serial and completed the
handshake. It reported nine fields with no tables in this build. Nothing was lost
and nothing was written back wrongly, because unknown fields are preserved and
partially understood sections are write blocked. That is the write gate working
against firmware nobody here wrote.

### Added
- `FromRadio` arms 17 `deviceuiConfig`, 18 `lockdown_status`, 19 `region_presets`.
- `Config` arm 10 `device_ui`, with the full `DeviceUIConfig` table and its
  `NodeFilter`, `NodeHighlight`, `Map` and `GeoPoint` sub messages, plus the
  Theme, Language, CompassMode and GpsCoordinateFormat enums.
- Every remaining `ModuleConfig` arm: `external_notification`, `canned_message`,
  `audio`, `remote_hardware`, `ambient_lighting`, `detection_sensor`,
  `paxcounter`, and also `statusmessage`, `traffic_management`, `tak` and
  `mesh_beacon`, which the Pager did not report but the next radio might.
- The `HardwareModel` enum ran to 65 and now runs to 143. The Pager is model 103
  and had been showing as an unnamed number.

### Engineering
- The simulator now sends all nine of the fields the Pager reported, and claims to
  be a T-Lora Pager, so the exact first contact case is exercised on every run.
- New assertion: a handshake that leaves anything partially understood fails.
  66 assertions, all green.
- `LoRaRegionPresetMap` nests further than this build reads. Its two repeated arms
  are held as bytes so the message decodes cleanly rather than having a structure
  invented for it.

### Unchanged
- Module config writes are still read and diff only.
- Reconnect with backoff is still not implemented.
- Everything in Known Limitations still stands. One handshake is not validation.

## v1.5.0 (2026-08-11)

Adds station 11 LOGBOOK. Every station in the roadmap is now built.

### Built
- **11 LOGBOOK.** The session as a record:
  - Records the raw serial lane, both directions, with millisecond timestamps
    from the start of recording, so a capture replays at the timing it happened.
  - Notes taken while you work, timestamped, and struck rather than deleted when
    you disagree with one later.
  - Replays a capture or a bundle back through the same framer and codec, at the
    recorded timing or faster. Every station behaves during a replay exactly as
    it does live.
  - One evidence bundle carrying the roster, codeplug, channels, packet log,
    telemetry, topology, traceroutes, notes and optionally the raw capture, with
    a note on each section saying what it claims and a short "reading this
    later" preamble at the top.
  - A printable summary, rendered into a print only region of the page, plus the
    same content as a Markdown export.

### Engineering
- A replay is now a genuinely one way session. It does not send a wake run, does
  not request a config, does not run a heartbeat and does not clear the state the
  recording has already delivered. That last one was a real defect: the session
  was wiping the replayed roster and config the moment it started its own
  handshake against a stream that cannot answer.
- A recording carrying no config_complete_id reports that plainly instead of
  sitting in handshake forever.
- The lane recorder is capped at 40000 events and stops rather than dropping from
  the middle, and says it was truncated.
- Byte fields serialise as hex in every export, so a bundle survives a JSON round
  trip without turning a key into an object of numbered digits.
- Self test suite grown from 60 to 65 assertions, all green, including a full
  record and replay cycle that rebuilds the same roster in a session that never
  saw the radio.

### Fixed
- The stub renderer is gone, since there are no stubs. An unknown station id now
  says so rather than rendering an empty page.

### Still not in this release
- Module config writes.
- Automatic reconnect with backoff.
- **Any confirmation against physical hardware.** Twelve stations, sixty five
  assertions, and not one byte has come off a real radio.

## v1.4.0 (2026-08-11)

Adds station 10 BEARING.

### Built
- **10 BEARING.** Where things are, relative to a reference you choose:
  - Reference can be this radio, any positioned node in the roster, or a point
    you type in.
  - Polar plot, north up, with range rings, cardinal marks and a scale bar, drawn
    from exactly the range and bearing figures in the table so the picture and
    the numbers cannot disagree.
  - Table of range, true bearing with its 16 point compass name, coordinates, fix
    age, location source and precision.
  - A node reporting reduced precision is drawn as the quantisation cell its
    firmware produced, dashed, rather than as a confident point.
  - Nodes heard with no position are listed separately rather than being placed
    at the reference or at zero.
  - Export as CSV or JSON, each carrying a note on what the figures mean.
- The simulated tracker node now coarsens its own position to 16 bits, so the
  privacy path is exercised rather than assumed.

### Engineering
- Position precision is decoded from the firmware quantisation: a mask of
  UINT32_MAX shifted by 32 minus the bit count, and a cell centre offset of one
  shifted by 31 minus the bit count. The half cell is reported in metres, and it
  narrows east to west with latitude while staying constant north to south.
- The plot is polar rather than projected, so it is built from the same haversine
  range and bearing the table shows. There is no second coordinate path that
  could drift from the first.
- niceRange, bearingCardinal, plotPoint and positionUncertainty are pure
  functions and are asserted directly.
- Self test suite grown from 56 to 60 assertions, all green.

### Fixed
- Switching the reference to another node showed "that node has no position" on
  the first paint, because the default node was chosen after the reference was
  resolved rather than before. It now reports correctly on the first paint.

### Still not in that release
- Station 11 LOGBOOK.
- Module config writes.
- Automatic reconnect with backoff.
- Any confirmation against physical hardware.

## v1.3.0 (2026-08-11)

Adds station 09 PATHFINDER.

### Built
- **09 PATHFINDER.** Observed topology, with the emphasis on observed:
  - Traceroute to any node in the roster, matched to its request, round trip
    timed, and both legs reconstructed the way firmware itself prints them.
  - Neighbour reports collected from NEIGHBORINFO_APP packets, shown with the
    reporting node, the SNR it claims, and when it last heard each neighbour.
  - An observed link graph built from three kinds of evidence kept apart rather
    than merged: heard directly at zero hops, reported second hand by another
    node, and walked by a traceroute. Every edge lists what put it there and
    when, in a table under the picture.
  - Radial layout, this radio at the centre, one ring per observed hop. No
    physics, no randomness, no animation loop, so the picture does not reshuffle
    itself on every repaint.
  - Export routes and topology as JSON, each carrying a note on what the data
    does and does not claim.
- **12 SIMULATOR** gains a neighbour report broadcast, and its traceroute reply
  now returns a genuine two hop path with an asymmetric return leg and one hop
  that reports no SNR.

### Engineering
- Traceroute SNR is decoded from the RouteDiscovery scale of dB times four, with
  INT8_MIN treated as "this hop reported no SNR" rather than as a very bad link.
- The return leg mapping is not a simple reversal: firmware walks route_back
  backwards while indexing snr_back forwards. That is transcribed exactly and
  asserted, because it is the kind of thing that looks right and is off by one.
- Link evidence is filtered on meaning, not convenience. A packet that used a hop
  is not evidence of a direct link, and a packet that arrived via MQTT is not
  evidence of a radio link at all.
- buildLinkGraph and graphLayout are pure functions, so the topology and the
  picture are both asserted without a DOM.
- Self test suite grown from 48 to 56 assertions, all green.

### Still not in that release
- Stations 10 BEARING, 11 LOGBOOK.
- Module config writes.
- Automatic reconnect with backoff.
- Any confirmation against physical hardware.

## v1.2.0 (2026-08-11)

Adds station 08 TELEMETRY.

### Built
- **08 TELEMETRY.** Readings retained for the session and charted:
  - Device metrics (battery, voltage, channel utilisation, air utilisation for
    transmit, uptime) and environment metrics (temperature, humidity, pressure,
    illuminance, gas, wind, rainfall, soil and the rest) charted per node.
  - Hand drawn SVG line charts with axis ticks, latest, lowest, highest and mean
    across the window. No charting library, because nothing here is fetched.
  - Selectable node, selectable readings, and a window of 15 minutes, 1 hour,
    6 hours or everything held.
  - A table of the latest reading from every reporting node, click through to
    chart it.
  - Export every node as CSV or JSON, and clear the record.
- **12 SIMULATOR** gains a telemetry backlog button, which delivers three hours
  of readings the way a store and forward node dumps a backlog. Real packets
  through the real path, so the charts have something to show without waiting.

### Engineering
- The session now retains telemetry rather than decoding it and throwing it
  away. Samples are filed under the reading time the radio reported, falling back
  to arrival time only when no timestamp was sent, because charting a delayed
  reading at its arrival moment would be an invented history.
- Samples arriving out of order are inserted in reading order, so a store and
  forward backlog fills in history behind the present instead of corrupting the
  series.
- Device metrics riding along on a NodeInfo are recorded too, deduplicated
  against a telemetry packet for the same second.
- Charts break where readings stop. A run separated by more than four times the
  usual spacing is drawn as two runs, so an outage reads as an outage rather than
  a straight line across it.
- Chart geometry is a pure function returning plot coordinates, path, ticks and
  summary, so it is asserted without a DOM.
- Self test suite grown from 40 to 48 assertions, all green.

### Fixed
- The telemetry station defaulted to whichever node reported first, which is
  usually one carrying a single reading from a NodeInfo. It now opens on the node
  with the most record, because one reading is not a chart.

### Still not in that release
- Stations 09 PATHFINDER, 10 BEARING, 11 LOGBOOK.
- Module config writes.
- Automatic reconnect with backoff.
- Any confirmation against physical hardware.

## v1.1.0 (2026-08-11)

Adds station 07 AIRTIME. Nothing else changed behaviourally.

### Built
- **07 AIRTIME.** The arithmetic that makes this an engineering instrument rather
  than a control panel, and the one station that needs no traffic to be useful:
  - Time on air across payload sizes from 1 byte to the 233 byte maximum, with
    effective bitrate counted on your payload rather than on the framing.
  - All nine modem presets compared side by side at an adjustable reference
    payload, with symbol time, LDRO state and a ratio against whatever the radio
    is currently set to.
  - The regional duty cycle budget: permitted duty, air time per hour, packets
    per hour, and the minimum spacing that keeps this radio inside the limit.
  - What the current session has cost the channel, computed from the packet
    lengths in station 03, shown next to the radio's own reported air
    utilisation where that is available.
  - What a hop limit spends, as an explicit upper bound with its assumptions
    stated in the panel rather than buried.
  - A provenance panel naming the source file for every constant.
- Settings are read live from the radio when one is connected, including the
  use_preset off case where bandwidth, spreading factor and coding rate are set
  explicitly. With no radio connected the station says so and labels its numbers
  as stated defaults rather than measurements.

### Engineering
- Time on air is transcribed from RadioLib `calculateTimeOnAir`, integer
  truncation intact, because matching the radio matters more than matching the
  textbook. Cross checked against a separately written float implementation of
  the Semtech datasheet formula across 45 cases: exact agreement, to the
  microsecond.
- Region table transcribed from the firmware `RDEF` table: 27 regions with duty
  cycle, power limit and wide band flag. A region outside that table produces no
  budget rather than a wrong one.
- Self test suite grown from 34 to 40 assertions, all green.

### Fixed
- Nothing. No defects were found in v1.0.0 during this increment. The one test
  failure raised during the work was a wrong constant typed by hand into the test
  itself, which the independent cross check caught. Reference values are now
  generated from that cross check rather than typed.

### Still not in that release
- Stations 08 TELEMETRY, 09 PATHFINDER, 10 BEARING, 11 LOGBOOK.
- Module config writes.
- Automatic reconnect with backoff.
- Any confirmation against physical hardware.

## v1.0.0 (2026-08-11)

First release. MVP stop for review.

### Built
- **01 LINK.** Web Serial port selection with an exposed baud setting, the
  resyncing frame reader, the debug lane as a first class view, the 300 second
  heartbeat, and a live tally of good frames, bytes in, stray bytes, resyncs and
  oversize length fields.
- **02 MUSTER.** Node roster with last heard (relative and absolute), hops away,
  SNR, battery and voltage, hardware and role, plus range and bearing computed
  from this radio's own reported position. Sortable on every column, exportable
  as CSV and JSON. Stale nodes fade rather than vanish.
- **03 TRAFFIC.** Every frame in and out, decoded by port, with a field tree and
  a hex dump on any row. Filters for port, node, direction and text. Export as
  JSON or CSV. Local decryption of encrypted packets using a key you supply.
- **04 DISPATCH.** Broadcast, per channel and direct text, with the delivery
  evidence chain shown rather than a checkmark: sent, queued, ack from the
  addressed node, implicit ack from a neighbour, NAK with its reason, or timeout.
- **05 CHANNELS.** The channel set as editable data. Key generation at 128 and
  256 bits, the documented single byte default key, paste and import, share URL
  generation and parsing, a locally drawn QR code, diff before write, backup
  first.
- **06 CODEPLUG.** Schema driven editor for every config section with enum names
  and unit hints, full backup, diff against the live radio, and writes through
  the admin path with the session passkey lifecycle surfaced.
- **12 SIMULATOR.** A synthetic radio behind the same interface as the serial
  port, seeded with nodes, channels and config, with five switchable fault modes:
  ragged frame delivery, interleaved debug chatter, bogus magic and oversize
  lengths, session passkey expiry, and heartbeat silence.

### Engineering
- Hand rolled protobuf wire codec. No library, no build step.
- Unknown fields preserved byte for byte and re-emitted in canonical field number
  order. Partially understood messages are flagged and write blocked.
- Schema tables transcribed from meshtastic/protobufs master on 2026-08-11, with
  framing, wake, heartbeat, passkey and modem preset facts read from
  meshtastic/python and meshtastic/firmware on the same date.
- Self contained QR encoder, byte mode, level L, versions 1 to 10.
- 34 assertions in the self test suite, all green.

### Fixed during the build
- Reed-Solomon generator polynomial was being built with its terms in reverse
  order, so every QR code was unreadable. Caught by decoding the output with an
  independent decoder rather than by looking at it.
- The simulator was emitting concurrent frames on what is physically a single
  ordered wire, so the handshake never completed. Output now drains through one
  lane, which is what a real serial port does.
- Debug log lines were being split at chunk boundaries, producing fragments like
  "IN" and "FO |". Lines are now assembled across chunks. A chunk boundary is not
  a line break.
- An ack from the node you addressed was being labelled an implicit ack. The two
  are different evidence and are now distinguished.

### Not in that release
- Stations 07 AIRTIME, 08 TELEMETRY, 09 PATHFINDER, 10 BEARING, 11 LOGBOOK.
- Module config writes.
- Automatic reconnect with backoff.
- Any confirmation against physical hardware.
