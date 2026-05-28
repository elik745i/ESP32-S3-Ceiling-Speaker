# ESP32-S3 Ceiling Speaker

Custom PlatformIO firmware for an ESP32-based Wi-Fi ceiling speaker and notifier with a MAX98357A I2S amplifier, browser-based configuration UI, MQTT and Home Assistant integration, GitHub Releases OTA updates, and configurable pin mapping for audio, OLED, battery, and status hardware.

## Current Release

- Firmware version: `v0.1.12`
- Primary OTA repository: `elik745i/ESP32-S3-Ceiling-Speaker`
- GitHub Releases feed: `https://api.github.com/repos/elik745i/ESP32-S3-Ceiling-Speaker/releases`
- Default ESP32-S3 HACS OTA asset: `esp32s3-notifier-hacs-v0.1.12.bin`

## What This Firmware Does

- Plays MP3, radio, and URL-based TTS streams over I2S audio
- Targets the MAX98357A amplifier path for the ESP32-S3 ceiling-speaker build
- Exposes a local web UI for playback, setup, monitoring, OTA, and pin remapping
- Publishes MQTT state and accepts MQTT playback and control commands
- Supports Home Assistant through standard MQTT topics and the HACS `mqtt_media_player` flow
- Checks GitHub Releases for OTA updates and installs the correct build asset for the active firmware variant
- Supports OLED status display, buzzer, touch buttons, battery monitoring, and configurable low-battery sleep

## Hardware Target

The current documented hardware target is the ESP32-S3 Super Mini ceiling-speaker build using:

- ESP32-S3 Super Mini
- MAX98357A I2S mono amplifier
- Ceiling speaker connected directly to the amplifier output
- 0.96 inch I2C OLED display
- Two TTP223 touch buttons
- Active buzzer

Repository hardware references:

- Circuit diagram: [Docs/circuit.png](Docs/circuit.png)
- ESP32-S3 pinout image: [Docs/esp32-s3_pinout.jpeg](Docs/esp32-s3_pinout.jpeg)
- 3D assets: [3D](3D)
- STL folder: [3D/STL](3D/STL)

![Current ceiling-speaker circuit diagram](Docs/circuit.png)

## Default ESP32-S3 Wiring

The ESP32-S3 environments in [platformio.ini](platformio.ini) default to this ceiling-speaker wiring:

| Function | GPIO |
|---|---:|
| I2S DOUT / DIN | 9 |
| I2S LRCLK / WS | 12 |
| I2S BCLK | 11 |
| Status LED | 10 |
| Battery ADC | 3 |
| OLED SDA | 4 |
| OLED SCL | 5 |
| Touch button 1 | 5 |
| Touch button 2 | 6 |
| Buzzer | 7 |

Notes:

- The web UI keeps I2S remapping available for the supported ESP32-S3 I2S pin set.
- OLED and other configurable pins are sanitized to avoid conflicts with active I2S pins.
- On the ceiling-speaker profiles, the documented amplifier is MAX98357A only.

## Audio Path

Audio playback is implemented with `schreibfaul1/ESP32-audioI2S` and configured for the MAX98357A standard I2S path.

Important current behavior:

- The firmware uses standard I2S format, not a PCM5102-specific path.
- The earlier software-side audio boost that could clip the stream was removed.
- Active stream replacement already uses fade-out and fade-in for smoother station switching.
- The Audio tab now allows changing Radio Browser stations directly while already playing.
- The top playback card now includes previous station, play or stop, and next station controls.

There is also a dedicated diagnostic build profile for isolated MAX98357A testing:

- `esp32s3_notifier_hacs_audio_test`

That build is meant for audio troubleshooting and is not part of the standard release asset matrix.

## Web UI

The web frontend lives in [web/index.html](web/index.html), [web/style.css](web/style.css), and [web/app.js](web/app.js), then gets embedded into firmware at build time through [scripts/asset_embed.py](scripts/asset_embed.py).

The web UI provides:

- Live Wi-Fi, MQTT, playback, battery, heap, and firmware status
- Radio Browser country and station selection
- Direct URL playback and TTS playback entry
- Smooth station switching from the Audio tab and playback dashboard controls
- Play or stop toggle plus previous and next station controls in the top playback card
- Volume control with immediate runtime update
- I2S pin remapping for MAX98357A wiring
- OLED pin remapping and display configuration
- Battery configuration and calibration helpers
- Firmware release browsing, OTA install, and local firmware upload
- Reboot and factory reset actions

## Build Profiles

Release-oriented PlatformIO environments:

- `esp32_notifier`
- `esp32_notifier_hacs`
- `esp32_notifier_hacs_slim`
- `esp32s3_notifier`
- `esp32s3_notifier_hacs`
- `esp32s3_notifier_hacs_slim`

Additional diagnostic environment:

- `esp32s3_notifier_hacs_audio_test`

Default workspace target in [platformio.ini](platformio.ini):

- `esp32s3_notifier_hacs`

## Build And Flash

Build the current default environment:

```powershell
pio run
```

Build a specific environment:

```powershell
pio run -e esp32s3_notifier_hacs
```

Upload:

```powershell
pio run -t upload
```

Open the serial monitor:

```powershell
pio device monitor -b 115200
```

## VS Code Tasks

This workspace already includes PlatformIO-oriented tasks. Useful task labels include:

- `PlatformIO: Verify`
- `PlatformIO: Upload (Auto Port)`
- `PlatformIO: Upload (COM7)`
- `PlatformIO: Monitor (Auto Port)`
- `PlatformIO: Monitor (COM7)`
- `PlatformIO: List Serial Devices`

## First Boot And Provisioning

On startup the firmware:

1. Loads saved settings from Preferences if available.
2. Falls back to compile-time defaults from [include/default_config.h](include/default_config.h) otherwise.
3. Attempts Wi-Fi station mode when credentials are configured.
4. Starts fallback AP mode if station credentials are missing or connection fails.

Fallback AP defaults:

- SSID prefix: `ESP32-Notifier-XXXXXX`
- Password: `12345678`
- Config page: `http://192.168.4.1`

## MQTT And Home Assistant

Default base topic:

- `esp32_notifier`

Typical command topics:

- `esp32_notifier/cmd/play`
- `esp32_notifier/cmd/tts`
- `esp32_notifier/cmd/stop`
- `esp32_notifier/cmd/volume`

Typical state topics:

- `esp32_notifier/availability`
- `esp32_notifier/state/playback`
- `esp32_notifier/state/network`
- `esp32_notifier/state/battery`
- `esp32_notifier/state/volume`

Example play payload:

```json
{"url":"https://example.com/stream.mp3","label":"Test Stream","type":"stream"}
```

Example volume payload:

```json
{"volumePercent":55}
```

For Home Assistant media-player style control, use the HACS-oriented build with `bkbilly/mqtt_media_player`:

- Recommended build: `esp32s3_notifier_hacs` for ESP32-S3 hardware
- Vendored backup integration: [home_assistant/custom_components/mqtt_media_player](home_assistant/custom_components/mqtt_media_player)

## OTA Releases

The Firmware tab checks GitHub Releases by default. OTA asset names must match the build variant the firmware expects.

Release asset names for `v0.1.12`:

- `esp32-notifier-v0.1.12.bin`
- `esp32-notifier-hacs-v0.1.12.bin`
- `esp32-notifier-hacs-slim-v0.1.12.bin`
- `esp32s3-notifier-v0.1.12.bin`
- `esp32s3-notifier-hacs-v0.1.12.bin`
- `esp32s3-notifier-hacs-slim-v0.1.12.bin`

GitHub release publishing is automated by [.github/workflows/platformio.yml](.github/workflows/platformio.yml): publishing a release triggers the workflow to build the six release variants and upload the matching OTA assets back to that release.

## Battery Monitoring

Battery monitoring is implemented in [src/battery_monitor.cpp](src/battery_monitor.cpp).

Current ESP32-S3 default behavior:

- The ESP32-S3 Super Mini profiles use `GPIO3` for voltage sensing.
- The default ESP32-S3 calibration multiplier is `2.0`.
- On some ESP32-S3 Super Mini boards this reflects a built-in VBUS divider rather than a true direct cell-voltage measurement.

If your reported voltage is off, recalibrate it from the Battery tab using a multimeter measurement.

## OLED Support

OLED support is handled by [src/display_manager.cpp](src/display_manager.cpp).

Current behavior:

- SSD1306 and SH1106 displays are supported.
- OLED pins can be remapped from the UI.
- OLED pin choices are sanitized to avoid clashes with active audio pins and other reserved functions.
- Only one display mode is intended to be active at a time.

## Repository Layout

Key files and directories:

- [platformio.ini](platformio.ini)
- [include/default_config.h](include/default_config.h)
- [include/settings_schema.h](include/settings_schema.h)
- [include/version.h](include/version.h)
- [src/main.cpp](src/main.cpp)
- [src/audio_player.cpp](src/audio_player.cpp)
- [src/settings_manager.cpp](src/settings_manager.cpp)
- [src/ota_manager.cpp](src/ota_manager.cpp)
- [src/web_server.cpp](src/web_server.cpp)
- [web/index.html](web/index.html)
- [web/style.css](web/style.css)
- [web/app.js](web/app.js)
- [home_assistant](home_assistant)
- [3D](3D)
- [Docs](Docs)

## Known Limitations

- Native Home Assistant core MQTT discovery alone is still not enough for a first-class `media_player` entity on the standard build.
- Some streams and codecs may still require library-side tuning depending on the source.
- Firmware size remains tight for OTA-capable builds.
- Basic web auth is supported, but it is still simple HTTP auth rather than a full access-control model.
- The current project is output-only audio. No microphone or duplex voice path is implemented.

## Release Notes

Current release notes live here:

- [release-assets/v0.1.12/release-notes.md](release-assets/v0.1.12/release-notes.md)
