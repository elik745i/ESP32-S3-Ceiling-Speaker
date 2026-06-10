ESP32 Notifier v0.1.12

- Aligned the firmware and documentation fully around the MAX98357A I2S amplifier path used by the ESP32-S3 ceiling-speaker build
- Removed the risky software-side audio boost that could clip or distort the output and added a dedicated audio diagnostic build/profile
- Kept UI-driven I2S remapping intact while enforcing safer OLED, battery, and audio pin conflict handling
- Added Radio Browser station switching from the UI with smooth stream replacement using fade-out and fade-in on the existing audio path
- Added top-card playback transport controls for previous station, play or stop, and next station
- Kept OTA release discovery aligned with GitHub Releases asset naming for the `elma-iot/ELMA-IoT` repository

Release assets:

- esp32-notifier-v0.1.12.bin
- esp32-notifier-hacs-v0.1.12.bin
- esp32-notifier-hacs-slim-v0.1.12.bin
- esp32s3-notifier-v0.1.12.bin
- esp32s3-notifier-hacs-v0.1.12.bin
- esp32s3-notifier-hacs-slim-v0.1.12.bin