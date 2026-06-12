ESP32 Notifier v0.1.22

- Added persistent motor runtime configuration that keeps learned open or closed state, semantic movement-role mapping, and touch-button motor actions across reboots.
- Added a dedicated motor runtime configuration flow in the web UI, along with richer learned-state status text for open, closed, opening, and closing feedback.
- Fixed motor runtime config persistence regressions by keeping the raw `ui.motorRuntimeConfig` payload durable in device settings instead of rewriting it destructively during save paths.
- Fixed Home Assistant motor control lag by publishing valve state immediately for both MQTT-triggered and web-triggered motor runs.
- Improved Home Assistant valve behavior by publishing the motor valve switch as an optimistic entity so the UI does not snap back during command round trips.
- Added MQTT and Home Assistant discovery support for CPU temperature as a standard retained temperature sensor.
- Improved input handling for motor setups by recognizing TTP223 touch-button profiles and correctly initializing configured limit-switch pins with the expected pull-up or pull-down mode.
- Added web asset ETag caching plus MQTT-tab rediscovery workflow polish for cleaner browser reloads and faster Home Assistant rediscovery.

Release assets:

- esp32-notifier-v0.1.22.bin
- esp32-notifier-hacs-v0.1.22.bin
- esp32-notifier-hacs-slim-v0.1.22.bin
- esp32s3-notifier-v0.1.22.bin
- esp32s3-notifier-hacs-v0.1.22.bin
- esp32s3-notifier-hacs-slim-v0.1.22.bin
