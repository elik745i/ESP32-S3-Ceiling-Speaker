ESP32 Notifier v0.1.26

- Improved runtime CPU frequency scaling with three performance levels: 80 MHz while idle, 160 MHz during stable audio playback, and 240 MHz for audio buffering, real-time EQ changes, OTA updates, and access-point mode.
- Added immediate performance upshifts plus delayed downshifts so audio and OTA work gain headroom without rapid clock changes during short state transitions.
- Fixed system metrics so the web UI and MQTT state report the current runtime CPU frequency instead of the boot-time frequency.
- Replaced the drifting idle-loop CPU-load estimate with per-core FreeRTOS scheduler-tick sampling, preventing steady workloads from gradually falling to a false 0% reading.
- Kept the scheduler-tick callbacks and their complete application-side sampling path in IRAM so NVS and OTA flash operations cannot invoke cached firmware code while the SPI flash cache is disabled.
- Added a dedicated CPU Clock card plus aggregate and per-core CPU load details to the Hardware Monitor.
- Added a persistent three-band I2S equalizer to the Audio tab with mouse-controllable custom gains plus Flat, Clear, Rock, Bass, Classical, Voice, Jazz, Podcast, and Night presets.
- Moved EQ updates to an independent real-time endpoint so changing a preset or band no longer remounts storage or reapplies unrelated runtime settings during playback; presets and custom gains are stored in NVS.
- Fixed Play/Stop state detection so background ambient audio no longer leaves the radio control stuck on Stop after the foreground station has stopped.
- Removed the redundant embedded ICO favicon while retaining the optimized SVG logo, recovering substantial OTA flash headroom without changing visible artwork.
- Audited embedded illustrations and retained multipass SVGO plus maximum gzip compression for every built-in SVG; added a build-time compressed-asset size report to catch future flash regressions.
- Fixed migration of the legacy `ESP32-S3-Ceiling-Speaker` OTA repository setting to `elma-iot/ELMA-IoT`, including devices that already saved the new owner with the old repository name.
- Fixed OTA asset resolution so a v0.1.25 device checking v0.1.26 requests the v0.1.26 filename instead of combining the new release path with the installed version's filename.
- Fixed default release selection to prefer the exact installed variant, preventing a full HACS device from preselecting the alphabetically earlier HACS Slim asset.
- Retained the v0.1.24 Wi-Fi station-only mode, modem sleep, and reduced station transmit-power optimizations.

Hardware validation:

- Recovered and reflashed the ESP32-S3 ceiling-speaker over native USB without erasing NVS.
- Confirmed the v0.1.26 release candidate boots, reconnects Wi-Fi and MQTT, plays radio continuously through EQ changes, boosts from 160 MHz to 240 MHz for filter updates before downshifting, reports nonzero per-core load, persists custom EQ gains, and returns Stop to Play when foreground playback ends.

Release assets:

- esp32-notifier-v0.1.26.bin
- esp32-notifier-hacs-v0.1.26.bin
- esp32-notifier-hacs-slim-v0.1.26.bin
- esp32s3-notifier-v0.1.26.bin
- esp32s3-notifier-hacs-v0.1.26.bin
- esp32s3-notifier-hacs-slim-v0.1.26.bin
