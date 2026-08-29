ELMA IoT v0.1.32

- Fixed Open Device Designer failing with `FlasherApplication object has no attribute designer_server`.
- The local designer server is now owned and initialized by the main ELMA Flasher application.
- Removed an erroneous recursive designer-server allocation from compile/flash jobs.
- The loopback server shuts down cleanly when ELMA Flasher exits.
- Packaged UI validation now launches the designer and verifies its local status API before release.

Release assets:

- esp32-notifier-v0.1.32.bin
- esp32-notifier-hacs-v0.1.32.bin
- esp32-notifier-hacs-slim-v0.1.32.bin
- esp32s3-notifier-v0.1.32.bin
- esp32s3-notifier-hacs-v0.1.32.bin
- esp32s3-notifier-hacs-slim-v0.1.32.bin
- esp32c3-notifier-hacs-v0.1.32.bin
- ELMA-Flasher-v0.1.32.exe
