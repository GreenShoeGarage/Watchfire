# WATCHFIRE

**FI-220 :: v1.7.0**

A bench for your Meshtastic radio, in one file.

A watchfire is a chain of signal fires relaying a message across distance, which
is what a mesh is.

WATCHFIRE is a Field Instrument: one HTML file, no server, no build step, no
network. Open it from disk, pick a serial port, and you get the wire, the
frames, the roster, the traffic and the codeplug as inspectable data. Nothing it
learns leaves the machine.

It is not a chat client with a serial port bolted on. It is a bench.

---

## Running it

Double click `watchfire.html`. That is the whole install.

Chromium treats a `file://` page as a secure context, so Web Serial works from
disk with no localhost server. If the browser has no `navigator.serial`,
WATCHFIRE says so plainly and everything except the radio link still runs,
including the whole simulator.

- **Browser:** a Chromium based desktop browser for the serial link (Chrome,
  Edge, Brave, Arc, Opera). Any modern browser for the simulator. Bluetooth
  additionally needs Web Bluetooth switched on, which some builds ship disabled:
  Brave hides it behind `brave://flags/#brave-web-bluetooth-api`, Opera does not
  ship it on desktop at all, and some Linux Chromium builds gate it behind
  `chrome://flags/#enable-experimental-web-platform-features`. A `file://` page
  is fine for bluetooth, same as for serial.
- **Hardware:** a Meshtastic radio on USB serial, 115200 baud by default (the
  baud setting is exposed anyway), or over Bluetooth Low Energy. **Pair the
  radio in your operating system bluetooth settings first**, entering the six
  digit passkey it shows on its screen. Firmware asks for bonding with man in
  the middle protection, the browser cannot enter a passkey, and an unpaired
  radio accepts the connection and then drops it.
- **Permissions:** the browser asks you to choose the port. Nothing else.

## First contact

**2026-08-11. A LILYGO T-Lora Pager, ESP32, 915 MHz.** The first physical radio
this instrument has ever seen.

It connected, completed the handshake, and immediately raised the partially
understood panel with nine fields:

| Reported as | What it actually is |
|---|---|
| `FromRadio#17` | `deviceuiConfig`, a `DeviceUIConfig` |
| `FromRadio.config#10` | `Config.device_ui` |
| `FromRadio.moduleConfig#3` | `external_notification` |
| `FromRadio.moduleConfig#7` | `canned_message` |
| `FromRadio.moduleConfig#8` | `audio` |
| `FromRadio.moduleConfig#9` | `remote_hardware` |
| `FromRadio.moduleConfig#11` | `ambient_lighting` |
| `FromRadio.moduleConfig#12` | `detection_sensor` |
| `FromRadio.moduleConfig#13` | `paxcounter` |

Every one of them is a section that was deliberately left out of the original
transcription. Not one is firmware doing something unexpected. The write gate did
exactly what it was built to do: it read what it understood, held what it did not
byte for byte, said so, and refused to write those sections back.

All nine are now transcribed, along with the three module sections the Pager did
**not** report (`statusmessage`, `traffic_management`, `tak`, `mesh_beacon`) and
the two remaining `FromRadio` arms (`lockdown_status`, `region_presets`). The
simulator now sends every one of the nine during its handshake, and an assertion
fails if a handshake leaves anything partially understood, so this exact case is
regression tested rather than remembered.

A second gap the same session exposed: the `HardwareModel` enum stopped at 65, so
the Pager showed as `103 (unnamed)` rather than by name. The enum now runs to 143.

**What first contact has confirmed:** the radio is reachable over Web Serial from
a `file://` page, the framing and resync are correct against real firmware output,
the handshake completes, the config burst parses, and the unknown field machinery
behaves under real conditions rather than only under conditions I invented.

**What it has not confirmed:** everything in Known Limitations below still stands.
One successful handshake is not a validated instrument.

## Bluetooth

**Confirmed working from a `file://` page against the Pager on 2026-08-11.** The
origin is not a problem for Web Bluetooth any more than it is for Web Serial.

BLE is not the serial protocol in a different coat, and the differences are
visible in the instrument rather than papered over:

- **There is no framing.** GATT already supplies the message boundary: one write
  is one `ToRadio`, one read is one `FromRadio`, and an empty read means the
  queue is drained. The deframer is bypassed entirely. An assertion checks it
  never sees a single byte, because the tempting shortcut here is to wrap each
  message in a synthetic `0x94 0xC3` header so the rest of the stack does not
  notice, and that would mean drawing bytes that were never on any wire.
- **THE WIRE therefore has nothing to show, and says so.** Station 01 replaces it
  over bluetooth with GATT counters: messages in, reads, notifies, empty reads,
  messages out, log lines.
- **`FromRadio` is polled, never subscribed to.** Firmware carries an explicit
  warning that adding notify to it breaks compatibility. Only `FromNum` is
  subscribed, and a notify says something is waiting but not how much, so
  `FromRadio` is read until it returns zero bytes.
- **The debug lane survives**, on its own characteristic, decoded as a `LogRecord`
  where firmware sends one and as plain text where it does not.
- **The keepalive is different.** An idle Pager dropped an otherwise healthy
  connection 35.8 seconds after connect, having never been sent anything.
  Firmware is explicit that a `ToRadio` is what keeps a radio awake for its
  client. A real session asks for config immediately so it should never be idle,
  but the bluetooth heartbeat runs every 15 s rather than the 300 s a serial link
  needs, because the failure is a silent disconnect.
- **All twelve stations work unchanged over bluetooth.** They sit above the
  transport interface and cannot tell the difference, which was the point of
  having one.

The whole path is exercised against a simulated GATT device, so bluetooth is not
the one untested transport.

## What is built

| # | Station | What it does |
|---|---------|--------------|
| 01 | LINK | Port selection, the resyncing frame reader, the debug lane, the heartbeat, and a live tally of good frames, stray bytes, resyncs and oversize length fields. |
| 02 | MUSTER | The node roster with last heard, hops away, SNR, battery, and range and bearing computed from this radio's own reported position. Sortable, exportable as CSV or JSON. Stale nodes fade rather than vanish. |
| 03 | TRAFFIC | The flight recorder. Every frame in and out, decoded by port, with a field tree and a hex dump on any row. Filter by port, node, direction or text. Export JSON or CSV. |
| 04 | DISPATCH | Text out and in, with the whole delivery chain shown: sent, queued, ack from the destination, implicit ack from a neighbour, NAK with its reason, or timeout. |
| 05 | CHANNELS | The channel set as editable data. Generate or paste keys, diff before write, share as a URL and a QR code drawn locally. |
| 06 | CODEPLUG | Config sections as a schema driven editor with enum names. Back up, diff, write through the admin path, compare the radio against an earlier backup. |
| 07 | AIRTIME | Time on air per payload size, effective bitrate, every preset compared, the regional duty cycle budget, what this session has cost the channel, and what a hop limit spends. Pure arithmetic on reported settings, so it is useful with no traffic at all. |
| 08 | TELEMETRY | Device and environment readings retained for the session and charted in hand drawn SVG. Charts break where readings stop rather than drawing a line through a silence. Samples are filed under the reading time the radio reported, not arrival time. Export CSV or JSON. |
| 09 | PATHFINDER | Traceroute with both legs reconstructed the way firmware prints them, neighbour reports, and an observed link graph laid out radially with no physics and no randomness. Every edge carries the evidence that put it there and when. |
| 10 | BEARING | Range and bearing from a reference you choose, and a polar plot drawn from exactly those figures. No map tiles and nothing fetched. A node that coarsened its own position is drawn as the cell its firmware quantised to rather than as a point. |
| 11 | LOGBOOK | Records the raw lane with timestamps, takes notes while you work, replays a capture back through the same reader, and exports one evidence bundle carrying what every other station knows, plus a printable summary. |
| 12 | SIMULATOR | A synthetic radio behind the same interface as the serial port, with switchable fault modes. |

All twelve stations are built.

## The central problem: protobuf with no build step

Meshtastic speaks protobuf. There is no `npm install` here and no minified
library blob was pasted in. Instead:

- The wire codec is hand rolled: varint, zigzag, fixed32, fixed64, length
  delimited, packed repeated fields, oneof tracking.
- The needed subset of the `.proto` definitions is transcribed into declarative
  JS schema tables.
- **Unknown fields are preserved.** A message with a field this build has never
  heard of keeps those bytes attached to the decoded object and re-emits them on
  encode, in canonical field number order. A config write never silently drops a
  field WATCHFIRE does not know about.
- Any message that failed to decode fully is flagged **partially understood** and
  is **write blocked**. The bench does not write back what it could not read.

## Protobuf transcription provenance

Schema tables were transcribed by hand from **github.com/meshtastic/protobufs,
master branch, on 2026-08-11**, and extended the same day after first contact
with a physical radio (see First contact below). These behaviours were read from source on the
same date rather than assumed:

| Fact | Source |
|------|--------|
| `START1 = 0x94`, `START2 = 0xC3`, 2 byte big endian length, 512 byte cap | `meshtastic/python` `meshtastic/stream_interface.py` |
| Wake run is **32 bytes of START2**, deliberately not START1, so the device keeps hunting for START1 and resyncs cleanly | `stream_interface.py` `connect()` |
| Heartbeat interval **300 seconds** | `meshtastic/python` `mesh_interface.py` `_startHeartbeat()` |
| `want_config_id` nonce, with `69420` reserved as the nodeless id | `mesh_interface.py` `_startConfig()` |
| `AdminMessage.session_passkey` is field **101**, type bytes | `meshtastic/protobufs` `admin.proto` |
| Admin writes run begin_edit_settings (64), set_config (34) or set_channel (33), commit_edit_settings (65) | `admin.proto` |
| Modem preset bandwidth, spreading factor and coding rate | `meshtastic/firmware` `src/mesh/MeshRadio.h`, `modemPresetToParams()` |
| Time on air arithmetic, kept in its integer form so it matches the radio rather than the textbook | `RadioLib` `src/modules/SX126x/SX126x.cpp`, `calculateTimeOnAir()` |
| Packet configuration: explicit header, CRC on, preamble 16 symbols, auto LDRO at a 16 ms symbol | `meshtastic/firmware` `src/mesh/RadioLibInterface.h`, `getPacketConfig()` |
| Over air header length of 16 bytes | `meshtastic/firmware` `src/mesh/RadioInterface.h`, `MESHTASTIC_HEADER_LENGTH` |
| Regional duty cycle and power limits, and which regions are wide band | `meshtastic/firmware` `src/mesh/RadioInterface.cpp`, the `RDEF` region table |
| Maximum data payload of 233 bytes | `meshtastic/protobufs` `mesh.proto`, `Constants.DATA_PAYLOAD_LEN` |
| Traceroute path reconstruction, the SNR scale of dB times four, and `INT8_MIN` as the sentinel for a hop that reported none | `meshtastic/firmware` `src/modules/TraceRouteModule.cpp` |
| Position precision quantisation: mask of `UINT32_MAX << (32 - bits)` with a cell centre offset of `1 << (31 - bits)` | `meshtastic/firmware` `src/modules/PositionModule.cpp` |

Where this build and upstream disagree, upstream wins. Corrections belong in this
table.

## House standards met

- One HTML file. All CSS, JS and art inline. Art is inline SVG, tones are
  synthesised with WebAudio, no sibling asset folders and no CDN fetch.
- No outbound network calls of any kind. No keys, no tokens, no analytics.
  The only I/O is Web Serial, user initiated file import and export, and the
  clipboard.
- Night default theme, plus Day and High Contrast, all checked for AA contrast.
- Fully keyboard operable with real semantic elements. Focus outlines restyled,
  never stripped. Roughly 44px targets. `prefers-reduced-motion` honoured.
- In app About panel with name, version, license, credits and where to send
  findings. In app debug logging toggle. In app mute. Built in self test button.
- Version shown in the UI and in a marker comment after the DOCTYPE.
- No `innerHTML` or `eval` anywhere near device or imported data. There is
  exactly one `innerHTML` in the file and it writes a static SVG mark with no
  interpolation. Everything from the radio is placed as a text node.
- Archive and export rather than hard delete.
- GPL-3.0, stated as plain text.

## Testing

71 assertions, all green as of this release. The same suite runs from the
**Self test** button in the masthead and from a headless harness.

- **Codec:** varint boundaries, negative int32, zigzag sint32, float and
  sfixed32, packed repeated fields, multibyte strings, every schema table round
  tripping, unknown field preservation byte for byte, a wire type that disagrees
  with the schema being kept rather than coerced, truncated input throwing, oneof
  arms.
- **Framer:** a frame delivered one byte at a time, magic bytes inside a payload,
  log text between frames, a length field over 512 forcing a resync without
  eating the next frame, START1 not followed by START2, refusing to build an
  illegal frame.
- **Flow:** the wake run being START2 rather than START1, a full handshake to
  `config_complete_id` with nodes, channels and config, a mismatched nonce being
  noticed, an ack carrying its evidence, an ack from the addressed node not being
  mislabelled implicit, passkey acquisition, a real config write landing on the
  radio, an expired passkey producing a visible NAK, and the write gate refusing
  a partially understood config.
- **Airtime:** symbol time and the LDRO threshold at its 16 ms boundary, time on
  air matching an independently arranged form of the datasheet formula to the
  microsecond across seven cases, monotonicity in payload and spreading factor,
  the region table limits, and the settings reader admitting when no radio is
  present rather than presenting defaults as measurements.
- **Telemetry:** flattening a Telemetry message into a dated sample and ignoring
  one carrying no readings, a store and forward backlog arriving out of order
  being filed in reading order, the per node cap rolling the oldest off, chart
  geometry mapping readings onto the plot and reporting the range, a silence
  breaking the line instead of being drawn through, flat and single reading
  series still producing a usable axis, and units being carried rather than
  invented.
- **Topology:** the traceroute SNR scale and its unknown sentinel, a direct route
  and a multi hop route reconstructing in the order firmware prints them
  including the return leg's non obvious index mapping, the link graph keeping
  heard, reported and walked evidence apart, a hopped packet not becoming a
  direct link, an MQTT packet not becoming a radio link at all, hop depth from
  the chain of evidence with islands admitting they have none, and a layout that
  is identical every time it is computed.
- **Position and bearing:** the precision cell decoding at several bit depths
  and narrowing east to west with latitude but not north to south, polar plot
  placement agreeing with the figures in the table, scale steps and the 16 point
  compass including a wrapped and a negative bearing, and range and bearing being
  measured from the chosen reference only, with reciprocal bearings checking out
  and a node with no position getting no range rather than a zero.
- **Logbook:** notes being timestamped and struck rather than deleted, the
  recorder holding both directions and stopping at its cap instead of dropping
  the middle, a full capture and replay cycle rebuilding the same roster and
  config in a session that never saw the radio, the evidence bundle carrying a
  note on every section and keeping the raw capture out unless asked for, byte
  fields surviving serialisation as hex, and the printable summary stating
  plainly when no radio was involved.
- **Bluetooth:** a full handshake over GATT with the deframer provably bypassed
  rather than fed invented headers, an unframed ToRadio going out and being
  acknowledged, the debug lane arriving on its own characteristic as whole lines,
  a radio that accepts then drops the link being reported as a pairing failure
  rather than a dead radio, and the GATT identifiers matching the firmware header.
- **Diff, channels, crypto, QR, geometry:** diff change counting, the share URL
  round trip, base64 across all 256 byte values, the documented single byte
  default key expansion, an AES-CTR round trip, QR version selection and
  structure, and haversine range and bearing.

The QR encoder was additionally verified against an independent decoder at
versions 1, 4, 6, 7 and 10 during the build. Two real defects were caught this
way and fixed: a reversed Reed-Solomon generator polynomial, and concurrent
simulator writes interleaving on what is physically a single ordered wire.

The airtime arithmetic was cross checked against a separate implementation of the
Semtech datasheet formula, written in its float form and arranged differently from
the integer form the app transcribed. All 45 comparison cases agree exactly, to
the microsecond. That check caught a wrong constant in the test itself rather than
in the code, which is the correct direction for a check to fail.

## Known Limitations

**One radio, one session, one handshake.** On 2026-08-11 a LILYGO T-Lora Pager
connected, completed the config handshake, and surfaced nine untranscribed fields
which have since been added. That is the entire extent of hardware validation.
Everything else below was exercised against the simulator only. WATCHFIRE was built against its own simulator, which speaks the real framing
and the real protobufs and can produce faults a working radio will not produce on
demand. That is a much better position than the sibling instrument BINNACLE was
in, which shipped through v1.1.0 against firmware source and a headless harness
alone. It is not the same as hardware confirmation.

Confirmed against the simulator only:

- The handshake to `config_complete_id`, the node, channel and config burst.
- Frame reassembly across ragged chunk boundaries, resync after bogus magic and
  oversize length fields, debug text sharing the lane.
- The admin path: passkey acquisition, begin edit, set config, commit, and a
  visible NAK when the passkey is stale.
- Text dispatch and the ack evidence chain.

Not confirmed at all:

- Real device timing. The 300 second heartbeat is transcribed from upstream and
  scheduled, but no radio has yet been left running long enough here to prove the
  keepalive keeps a real client alive.
- Reconnect with backoff after a physical unplug. The transport reports a close
  and the UI shows it; automatic reconnection is not implemented in v1.0.
- Baud rates other than 115200.
- Firmware other than the 2.7 era protobufs these tables were transcribed from.
  Older firmware will produce more partially understood messages, which is the
  designed behaviour, not a failure.

Other limits worth stating plainly:

- **Module config writes are read only.** Module sections display and diff, but
  the write button is disabled for them.
- **A raw capture is key material.** It is every byte in both directions, so if
  you write a channel or a codeplug while recording, the capture contains the
  channel key and the admin session passkey in the clear. The station says so
  where you press the button, the capture is unticked in the bundle by default,
  and it is still your decision what leaves the machine.
- **A replay is one way.** Nothing can be written to a recording, the heartbeat
  does not run, and the session does not request a config because there is
  nothing there to answer. Every station otherwise behaves exactly as it does
  live. A recording carrying no config_complete_id never completes, and says so
  rather than hanging.
- The lane recorder stops at 40000 events rather than growing without limit.
  What was captured stays intact and exportable, and nothing is dropped from the
  middle.
- **BEARING has no map and will not grow one by fetching tiles.** It is a polar
  plot with a scale bar, north up, true bearings with no magnetic declination
  applied. There is no terrain, no coastline and no roads, because none of that
  can be drawn without contacting somebody.
- **A coarsened position is not sharpened.** Where a node reports reduced
  precision_bits it has deliberately quantised its own position before
  transmitting, and WATCHFIRE draws the cell it quantised to rather than
  pretending the centre point is a fix. That is a privacy setting working, not a
  bad GPS.
- **The link graph is observed, never authoritative.** A mesh has no routing
  table to read. Every edge is a claim made by some evidence at some moment, and
  a report from an hour ago is an hour old. Ring position is the shortest chain
  of evidence back to this radio, not a prediction of how a packet would be
  routed. Nodes move, batteries die, and links are frequently not symmetric: a
  node telling you it hears another says nothing about the reverse direction.
- **Traceroute costs airtime in both directions** and is a real flooded packet.
  Station 07 will tell you what it costs. Nothing is retried automatically, and
  a request that gets no answer is reported as unanswered rather than as a
  broken path, because no answer could equally mean a busy channel or a node
  that is awake and not replying.
- **The hop cost table in AIRTIME is a deliberately crude upper bound.** It
  assumes every node in range rebroadcasts once per hop, capped at six. Real
  meshes are kinder: firmware suppresses a rebroadcast once it has heard the
  packet relayed, some roles never rebroadcast, and nodes out of range of each
  other do not double up. Use it to compare hop limits against each other, not to
  predict a number.
- **The duty cycle figures are the firmware table, not legal advice.** They are
  what firmware enforces and what the regional power column records. If you are
  operating anywhere near a limit, read the regulation rather than the panel.
- The session airtime estimate in AIRTIME counts only what this radio heard and
  sent. Anything out of range, on another channel, or missed while the port was
  closed is not in it, and payload length for a decoded packet includes a small
  allowance for the Data wrapper, so it is close rather than exact. Where the
  radio reports its own air utilisation, that number is shown and is the one to
  trust.
- The QR encoder covers versions 1 to 10 at error correction level L, byte mode.
  A channel set larger than that will not draw a code, and says so rather than
  drawing a broken one.
- Decryption is offered only for packets that arrive encrypted, which over serial
  means channels the radio itself has no key for. A wrong key produces noise, not
  an error, so the honest test is whether the result parses as a `Data` message.
- The PWA layer is additive and inert from `file://`. A service worker cannot be
  registered from a `file://` page, so `watchfire-sw.js` is only used if you
  happen to serve the folder over http. The instrument is complete without it.
- Position handling assumes a well formed fix. A latitude and longitude of
  exactly zero is treated as no fix rather than as a point in the Gulf of Guinea.
- The packet log holds 2000 entries, the debug lane 800 lines, and the telemetry
  record 900 samples per node, then they roll. Export before you need the older
  end of any of them.
- **Telemetry is session only.** Nothing is written to disk unless you export it,
  and closing the tab loses the record. Charts are drawn from what this radio
  heard, so a node reporting to a part of the mesh you cannot hear is not in
  them.
- Telemetry samples are filed under the reading time the radio reported. A store
  and forward node delivering a backlog will therefore fill in history behind the
  present, which is correct, and means the chart can change shape in the past.
  Where a node reports no timestamp at all, arrival time is used instead.

## On keys

WATCHFIRE can decrypt channel traffic using keys you already hold, on a mesh you
operate. That is the whole intended use, and it is why the key entry field exists
at all. Pointing it at somebody else's mesh is not something this instrument is
for, and the About panel says so in the app as well as here.

## License

GPL-3.0

The full text is in COPYING.

## Credits

No third party libraries are vendored. The protobuf codec, the serial framer, the
QR encoder and the simulator are written in this file.

Meshtastic is a trademark of the Meshtastic project. This instrument is not
affiliated with, endorsed by, or supported by that project.

Findings, corrections and first contact reports are welcome, especially a report
from anyone who points this at a real radio before I do.

Make. Hack. Learn. Share. Repeat.
