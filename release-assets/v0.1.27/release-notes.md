ESP32 Notifier v0.1.27

- Fixed selected GitHub firmware installs getting stuck at `Resolving release` after the release list had been refreshed; compatible current, older, and alternate build assets can now be deliberately reinstalled.
- Optimized the idle service loop by rate-limiting unchanged Wi-Fi state publication, reducing full runtime snapshots to 50 Hz, bypassing disabled audio/battery work, and using a playback-aware idle yield.
- Hardware validation reduced idle load from about 25-31% aggregate / 48-53% Core 1 to typically 0-2%, with the ESP32-S3 die reading falling from 71 C to about 42 C at 80 MHz.
- Added a Tasmota-style AP-to-STA browser handoff that displays the assigned station IP and reconnects the setup client to the device after the fallback AP closes.
- Fixed Wi-Fi scans during station retry activity and prevented partial credential edits from being saved before the explicit Connect action.
- Added a prominent persistent Firmware-tab alert for failed OTA updates and bootloader rollbacks.
- The alert shows the attempted firmware, the restored working version, and the stored rollback or health-check failure cause after reboot.
- Added a separate pending-verification state while newly installed firmware is completing its post-update health check.
- Persisted the attempted release or local-upload filename before reboot so even images that fail before completing setup can be identified after rollback.
- Preserved detailed runtime initialization failures when firmware explicitly requests a rollback.
- Kept healthy boots free of rollback warnings while retaining the diagnostic record after an actual failed update.
- Fixed File Manager autoplay, shuffle, and repeat using a firmware completion sequence that cannot be missed between browser status polls; automatic queue advancement is explicitly limited to File Manager-originated playback.
- Added decoder-backed track position, duration, and seeking controls to the File Manager player, synchronized across inline and preview views and reset for every track change.
- Moved firmware release checks to a background FreeRTOS task and increased the audio input queue to 1.25 MiB in PSRAM (with a 32 KiB SRAM fallback), preventing GitHub TLS/JSON work from starving radio, SD, or ambient playback.
- Protected startup audio until its natural completion so boot-time cues, update checks, ambient resume, and saved playback cannot interrupt it.
- Added centralized effect arbitration: compatible WAV cues duck/overlay, while exclusive notification/update/low-battery effects fade out, preserve local track position, play, then resume and fade in; alarms and shutdown flows remain exclusive by design.
- Remembered the last File Manager target and directory across reloads/reboots, with automatic parent/root fallback when a saved folder disappears.
- Cached FLAC duration once per track to avoid decoder-state polling clicks, and reconstructed/focused the live playing file after reload so its progress bar continues from firmware status.
- Redesigned the File Manager player with smooth 3D track and volume meters, contrast-aware embedded labels, overflow marquees, and a reliable global Play/Stop toggle.
- Restyled the folder and dashboard transport controls as aligned 3D buttons with larger centered Play/Stop icons and double-triangle Previous/Next icons.
- Previous/Next now follow the active source: folder playback advances within its folder, radio playback changes stations, and holding the controls seeks through local tracks in ten-second steps.
- Replaced the dashboard playback status text with a compact title-in-progress meter that reports track position or radio buffering without redundant Playing/Stopped labels.
- Kept the active File Manager row highlighted while moving it to the top only when the track changes; manual page, folder, and list scrolling is no longer overridden by repeated status polling.
- Retained v0.1.26 dynamic CPU scaling, live per-core load and clock monitoring, persistent real-time EQ, serialized boot audio, optimized embedded SVG assets, folder playback controls, and exact OTA variant selection.

Hardware validation:

- Built and USB-flashed the ESP32-S3 HACS image on the ceiling-speaker hardware without erasing NVS.
- Confirmed the device reports v0.1.27 normally with no false rollback alert after a healthy boot.

Release assets:

- esp32-notifier-v0.1.27.bin
- esp32-notifier-hacs-v0.1.27.bin
- esp32-notifier-hacs-slim-v0.1.27.bin
- esp32s3-notifier-v0.1.27.bin
- esp32s3-notifier-hacs-v0.1.27.bin
- esp32s3-notifier-hacs-slim-v0.1.27.bin
