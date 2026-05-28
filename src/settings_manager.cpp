#include "settings_manager.h"

#include <math.h>

#include "default_config.h"

namespace {
constexpr char PREF_NAMESPACE[] = "notifier";
constexpr char PREF_MARKER[] = "saved";
constexpr float kLegacyEsp32BatteryCalibration = 3.866f;

bool approximatelyEqual(float left, float right, float tolerance = 0.05f) {
    return fabsf(left - right) <= tolerance;
}

bool isValidBatteryAdcPin(uint8_t pin) {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    if (pin < 1 || pin > 20) {
        return false;
    }
    return true;
#else
    return true;
#endif
}

bool isValidStatusLedPin(uint8_t pin) {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    return pin <= 48;
#else
    return pin <= 39;
#endif
}

bool isValidWapeTriggerPin(uint8_t pin) {
    if (pin == 0) {
        return true;
    }
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    return pin <= 48;
#else
    return pin <= 39;
#endif
}

bool isValidI2sPin(uint8_t pin) {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    return pin >= 9 && pin <= 12;
#else
    return pin <= 39;
#endif
}

bool hasDistinctI2sPins(const AudioSettings& settings) {
    return settings.bclkPin != settings.wsPin && settings.bclkPin != settings.doutPin && settings.wsPin != settings.doutPin;
}

bool batteryPinConflictsWithI2s(const BatterySettings& battery, const AudioSettings& audio) {
    return battery.adcPin == audio.bclkPin || battery.adcPin == audio.wsPin || battery.adcPin == audio.doutPin;
}

bool chargingSensePinConflicts(const BatterySettings& battery, const AudioSettings& audio, const DeviceSettings& device) {
    if (battery.chargingSensePin == 0) {
        return false;
    }
    return battery.chargingSensePin == battery.adcPin || battery.chargingSensePin == audio.bclkPin ||
           battery.chargingSensePin == audio.wsPin || battery.chargingSensePin == audio.doutPin ||
           battery.chargingSensePin == device.statusLedPin;
}

bool oledPinConflicts(const OledSettings& oled, const AudioSettings& audio, const BatterySettings& battery, const DeviceSettings& device) {
    String displayType = oled.displayType;
    displayType.trim();
    displayType.toLowerCase();
    if (!oled.enabled || displayType == "wape") {
        return false;
    }

    const auto conflictsWithReservedPins = [&](int pin) {
        if (pin < 0) {
            return false;
        }

        return pin == audio.bclkPin || pin == audio.wsPin || pin == audio.doutPin ||
               pin == battery.adcPin || pin == battery.chargingSensePin ||
               pin == device.statusLedPin || pin == DefaultConfig::BUTTON1_PIN ||
               pin == DefaultConfig::BUTTON2_PIN;
    };

    if (oled.sdaPin == oled.sclPin) {
        return true;
    }
    if (oled.resetPin >= 0 && (oled.resetPin == oled.sdaPin || oled.resetPin == oled.sclPin)) {
        return true;
    }

    return conflictsWithReservedPins(oled.sdaPin) || conflictsWithReservedPins(oled.sclPin) ||
           conflictsWithReservedPins(oled.resetPin);
}

bool wapeTriggerPinConflicts(const OledSettings& oled, const AudioSettings& audio, const BatterySettings& battery, const DeviceSettings& device) {
    if (oled.wapeTriggerPin == 0) {
        return false;
    }
    return oled.wapeTriggerPin == audio.bclkPin || oled.wapeTriggerPin == audio.wsPin || oled.wapeTriggerPin == audio.doutPin ||
           oled.wapeTriggerPin == battery.adcPin || oled.wapeTriggerPin == device.statusLedPin
#if defined(CONFIG_IDF_TARGET_ESP32S3)
           || oled.wapeTriggerPin == 21
#endif
        ;
}

String normalizeDisplayType(String value) {
    value.trim();
    value.toLowerCase();
    return value == "wape" ? String("wape") : String("oled");
}

String normalizeWapeTriggerEvent(String value) {
    value.trim();
    value.toLowerCase();
    value.replace('-', '_');
    value.replace(' ', '_');
    if (value == "device_start" || value == "charging_start") {
        return value;
    }
    return String("play_start");
}

uint8_t fallbackBatteryAdcPin(const AudioSettings& audio) {
    BatterySettings candidate;
    candidate.adcPin = DefaultConfig::BATTERY_ADC_PIN;
    if (!batteryPinConflictsWithI2s(candidate, audio)) {
        return DefaultConfig::BATTERY_ADC_PIN;
    }
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    for (uint8_t pin = 1; pin <= 20; ++pin) {
        candidate.adcPin = pin;
        if (!batteryPinConflictsWithI2s(candidate, audio)) {
            return pin;
        }
    }
#endif
    return DefaultConfig::BATTERY_ADC_PIN;
}

String defaultDeviceBaseName() {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    return "ceiling-speaker";
#else
    return DefaultConfig::DEVICE_NAME;
#endif
}

String defaultFriendlyBaseName() {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    return "Ceiling Speaker";
#else
    return DefaultConfig::FRIENDLY_NAME;
#endif
}

String defaultOtaAssetTemplate() {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    #ifdef APP_ENABLE_HACS_MQTT
    #ifdef APP_DISABLE_WEB_UI
        return "esp32s3-notifier-hacs-slim-${version}.bin";
    #else
        return "esp32s3-notifier-hacs-${version}.bin";
    #endif
    #else
        return "esp32s3-notifier-${version}.bin";
    #endif
#else
    #ifdef APP_ENABLE_HACS_MQTT
        #ifdef APP_DISABLE_WEB_UI
        return "esp32-notifier-hacs-slim-${version}.bin";
        #else
        return "esp32-notifier-hacs-${version}.bin";
        #endif
    #else
        return DefaultConfig::OTA_ASSET_TEMPLATE;
    #endif
#endif
}

template <typename T>
T clampValue(T value, T low, T high) {
    if (value < low) {
        return low;
    }
    if (value > high) {
        return high;
    }
    return value;
}

String fallbackIfEmpty(const String& value, const String& fallback) {
    return value.isEmpty() ? fallback : value;
}

String hardwareIdSuffix(bool uppercase = false) {
    const uint64_t chipId = ESP.getEfuseMac();
    const uint32_t shortId = static_cast<uint32_t>(chipId & 0xFFFFFF);

    char buffer[7];
    snprintf(buffer, sizeof(buffer), uppercase ? "%06lX" : "%06lx", static_cast<unsigned long>(shortId));
    return String(buffer);
}

String defaultDeviceName() {
    return defaultDeviceBaseName() + "-" + hardwareIdSuffix(false);
}

String defaultFriendlyName() {
    return defaultFriendlyBaseName() + " " + hardwareIdSuffix(true);
}

bool matchesAnyNormalized(const String& value, std::initializer_list<const char*> patterns) {
    for (const char* pattern : patterns) {
        if (value == String(pattern)) {
            return true;
        }
    }
    return false;
}

bool isLegacyDefaultDeviceName(const String& value) {
    String normalized = value;
    normalized.trim();
    normalized.toLowerCase();
    return normalized == defaultDeviceBaseName() ||
        matchesAnyNormalized(normalized, {"esp32-notifier", "esp32s3-notifier", "ceiling-speaker"});
}

bool isLegacyDefaultFriendlyName(const String& value) {
    String normalized = value;
    normalized.trim();
    return normalized == defaultFriendlyBaseName() ||
        matchesAnyNormalized(normalized, {"ESP32 Notifier", "ESP32-S3 Notifier", "Ceiling Speaker"}) ||
        isLegacyDefaultDeviceName(normalized);
}

String normalizeButtonAction(String value, const char* fallback) {
    value.trim();
    value.toLowerCase();
    value.replace('-', '_');
    value.replace(' ', '_');

    if (value == "none" || value == "previous" || value == "next" || value == "play_pause" ||
        value == "replay_current" || value == "stop" || value == "volume_up" || value == "volume_down" ||
        value == "ha_previous" || value == "ha_next") {
        return value;
    }

    return String(fallback);
}
}  // namespace

bool SettingsManager::begin() {
    return preferences_.begin(PREF_NAMESPACE, false);
}

SettingsBundle SettingsManager::defaults() const {
    SettingsBundle settings;
    const String uniqueDeviceName = defaultDeviceName();
    const String uniqueFriendlyName = defaultFriendlyName();

    settings.wifi.ssid = DefaultConfig::WIFI_SSID;
    settings.wifi.password = DefaultConfig::WIFI_PASSWORD;
    settings.wifi.apSsid = "";
    settings.wifi.apPassword = DefaultConfig::WIFI_AP_PASSWORD;
    settings.wifi.apFallbackEnabled = DefaultConfig::WIFI_AP_FALLBACK_ENABLED;

    settings.mqtt.host = DefaultConfig::MQTT_HOST;
    settings.mqtt.port = DefaultConfig::MQTT_PORT;
    settings.mqtt.username = DefaultConfig::MQTT_USERNAME;
    settings.mqtt.password = DefaultConfig::MQTT_PASSWORD;
    settings.mqtt.baseTopic = DefaultConfig::MQTT_BASE_TOPIC;
    settings.mqtt.discoveryEnabled = DefaultConfig::MQTT_DISCOVERY_ENABLED;

    settings.ota.owner = DefaultConfig::OTA_OWNER;
    settings.ota.repository = DefaultConfig::OTA_REPOSITORY;
    settings.ota.channel = DefaultConfig::OTA_CHANNEL;
    settings.ota.assetTemplate = defaultOtaAssetTemplate();
    settings.ota.manifestUrl = DefaultConfig::OTA_MANIFEST_URL;
    settings.ota.allowInsecureTls = DefaultConfig::OTA_ALLOW_INSECURE_TLS;

    settings.battery.calibrationMultiplier = DefaultConfig::BATTERY_CALIBRATION;
    settings.battery.adcPin = DefaultConfig::BATTERY_ADC_PIN;
    settings.battery.chargingSensePin = 0;
    settings.battery.updateIntervalMs = DefaultConfig::BATTERY_UPDATE_INTERVAL_MS;
    settings.battery.movingAverageWindowSize = DefaultConfig::BATTERY_MOVING_AVERAGE_WINDOW;

    settings.webAuth.enabled = DefaultConfig::WEB_AUTH_ENABLED;
    settings.webAuth.username = DefaultConfig::WEB_USERNAME;
    settings.webAuth.password = DefaultConfig::WEB_PASSWORD;

    settings.audio.doutPin = DefaultConfig::I2S_DOUT_PIN;
    settings.audio.wsPin = DefaultConfig::I2S_WS_PIN;
    settings.audio.bclkPin = DefaultConfig::I2S_BCLK_PIN;

    settings.oled.enabled = DefaultConfig::OLED_ENABLED;
    settings.oled.displayType = "oled";
    settings.oled.driver = DefaultConfig::OLED_DRIVER;
    settings.oled.i2cAddress = DefaultConfig::OLED_I2C_ADDRESS;
    settings.oled.width = DefaultConfig::OLED_WIDTH;
    settings.oled.height = DefaultConfig::OLED_HEIGHT;
    settings.oled.rotation = DefaultConfig::OLED_ROTATION;
    settings.oled.sdaPin = DefaultConfig::OLED_SDA_PIN;
    settings.oled.sclPin = DefaultConfig::OLED_SCL_PIN;
    settings.oled.resetPin = DefaultConfig::OLED_RESET_PIN;
    settings.oled.dimTimeoutSeconds = DefaultConfig::OLED_DIM_TIMEOUT_SECONDS;
    settings.oled.wapeTriggerPin = 0;
    settings.oled.wapeTriggerEvent = "play_start";

    settings.device.deviceName = uniqueDeviceName;
    settings.device.friendlyName = uniqueFriendlyName;
    settings.device.statusLedPin = DefaultConfig::STATUS_LED_PIN;
    settings.device.savedVolumePercent = DefaultConfig::DEFAULT_VOLUME_PERCENT;
    settings.device.audioMuted = DefaultConfig::DEFAULT_AUDIO_MUTED;
    settings.device.button1Action = DefaultConfig::BUTTON1_DEFAULT_ACTION;
    settings.device.button2Action = DefaultConfig::BUTTON2_DEFAULT_ACTION;
    settings.device.lowBatterySleepEnabled = DefaultConfig::LOW_BATTERY_SLEEP_ENABLED;
    settings.device.lowBatterySleepThresholdPercent = DefaultConfig::LOW_BATTERY_SLEEP_THRESHOLD_PERCENT;
    settings.device.lowBatteryWakeIntervalMinutes = DefaultConfig::LOW_BATTERY_WAKE_INTERVAL_MINUTES;
    settings.usingSavedSettings = false;
    return settings;
}

SettingsBundle SettingsManager::sanitize(const SettingsBundle& input) const {
    SettingsBundle settings = input;
    settings.wifi.ssid.trim();
    settings.wifi.password.trim();
    settings.wifi.apSsid.trim();
    settings.wifi.apPassword.trim();
    settings.device.deviceName.trim();
    settings.device.friendlyName.trim();
    settings.mqtt.baseTopic.trim();
    settings.mqtt.host.trim();
    settings.ota.owner.trim();
    settings.ota.repository.trim();
    settings.ota.channel.trim();
    settings.ota.assetTemplate.trim();
    settings.ota.manifestUrl.trim();
    settings.webAuth.username.trim();

    if (settings.device.deviceName.isEmpty() || isLegacyDefaultDeviceName(settings.device.deviceName)) {
        settings.device.deviceName = defaultDeviceName();
    }
    if (settings.device.friendlyName.isEmpty() || isLegacyDefaultFriendlyName(settings.device.friendlyName)) {
        settings.device.friendlyName = defaultFriendlyName();
    }
    if (settings.mqtt.baseTopic.isEmpty()) {
        settings.mqtt.baseTopic = DefaultConfig::MQTT_BASE_TOPIC;
    }
    if (settings.ota.assetTemplate.isEmpty() || settings.ota.assetTemplate == DefaultConfig::OTA_ASSET_TEMPLATE ||
        settings.ota.assetTemplate == "esp32-notifier-hacs-${version}.bin" || settings.ota.assetTemplate == "esp32-notifier-hacs-slim-${version}.bin" ||
        settings.ota.assetTemplate == "esp32s3-notifier-${version}.bin" || settings.ota.assetTemplate == "esp32s3-notifier-hacs-${version}.bin" ||
        settings.ota.assetTemplate == "esp32s3-notifier-hacs-slim-${version}.bin") {
        settings.ota.assetTemplate = defaultOtaAssetTemplate();
    }
    if (settings.mqtt.port == 0) {
        settings.mqtt.port = DefaultConfig::MQTT_PORT;
    }
    if (!settings.wifi.apPassword.isEmpty() && settings.wifi.apPassword.length() < 8) {
        settings.wifi.apPassword = DefaultConfig::WIFI_AP_PASSWORD;
    }
    if (settings.wifi.apPassword.isEmpty()) {
        settings.wifi.apPassword = DefaultConfig::WIFI_AP_PASSWORD;
    }
    if (settings.device.savedVolumePercent > 100) {
        settings.device.savedVolumePercent = 100;
    }
    if (!isValidStatusLedPin(settings.device.statusLedPin)) {
        settings.device.statusLedPin = DefaultConfig::STATUS_LED_PIN;
    }
    settings.device.button1Action = normalizeButtonAction(settings.device.button1Action, DefaultConfig::BUTTON1_DEFAULT_ACTION);
    settings.device.button2Action = normalizeButtonAction(settings.device.button2Action, DefaultConfig::BUTTON2_DEFAULT_ACTION);
    settings.device.lowBatterySleepThresholdPercent = clampValue<uint8_t>(settings.device.lowBatterySleepThresholdPercent, static_cast<uint8_t>(1), static_cast<uint8_t>(100));
    settings.device.lowBatteryWakeIntervalMinutes = clampValue<uint16_t>(settings.device.lowBatteryWakeIntervalMinutes, static_cast<uint16_t>(0), static_cast<uint16_t>(1440));
    settings.battery.calibrationMultiplier = clampValue<float>(settings.battery.calibrationMultiplier, 0.1f, 10.0f);
    if (!isValidI2sPin(settings.audio.bclkPin)) {
        settings.audio.bclkPin = DefaultConfig::I2S_BCLK_PIN;
    }
    if (!isValidI2sPin(settings.audio.wsPin)) {
        settings.audio.wsPin = DefaultConfig::I2S_WS_PIN;
    }
    if (!isValidI2sPin(settings.audio.doutPin)) {
        settings.audio.doutPin = DefaultConfig::I2S_DOUT_PIN;
    }
    if (!hasDistinctI2sPins(settings.audio)) {
        settings.audio.bclkPin = DefaultConfig::I2S_BCLK_PIN;
        settings.audio.wsPin = DefaultConfig::I2S_WS_PIN;
        settings.audio.doutPin = DefaultConfig::I2S_DOUT_PIN;
    }
    if (!isValidBatteryAdcPin(settings.battery.adcPin) || batteryPinConflictsWithI2s(settings.battery, settings.audio)) {
        settings.battery.adcPin = fallbackBatteryAdcPin(settings.audio);
    }
    if (!isValidBatteryAdcPin(settings.battery.chargingSensePin) || chargingSensePinConflicts(settings.battery, settings.audio, settings.device)) {
        settings.battery.chargingSensePin = 0;
    }
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    if (approximatelyEqual(settings.battery.calibrationMultiplier, kLegacyEsp32BatteryCalibration)) {
        settings.battery.calibrationMultiplier = DefaultConfig::BATTERY_CALIBRATION;
    }
#endif
    settings.battery.updateIntervalMs = settings.battery.updateIntervalMs < 250 ? 250 : settings.battery.updateIntervalMs;
    settings.battery.movingAverageWindowSize = clampValue<uint16_t>(settings.battery.movingAverageWindowSize, static_cast<uint16_t>(1), static_cast<uint16_t>(32));
    settings.oled.displayType = normalizeDisplayType(settings.oled.displayType);
    settings.oled.driver.toLowerCase();
    if (settings.oled.driver != "ssd1306" && settings.oled.driver != "sh1106") {
        settings.oled.driver = "ssd1306";
    }
    settings.oled.i2cAddress = clampValue<uint8_t>(settings.oled.i2cAddress, static_cast<uint8_t>(1), static_cast<uint8_t>(127));
    settings.oled.width = clampValue<uint8_t>(settings.oled.width, static_cast<uint8_t>(64), static_cast<uint8_t>(128));
    settings.oled.height = clampValue<uint8_t>(settings.oled.height, static_cast<uint8_t>(32), static_cast<uint8_t>(64));
    if (settings.oled.rotation != 0 && settings.oled.rotation != 90 && settings.oled.rotation != 180 && settings.oled.rotation != 270) {
        settings.oled.rotation = 0;
    }
    settings.oled.dimTimeoutSeconds = clampValue<uint16_t>(settings.oled.dimTimeoutSeconds, static_cast<uint16_t>(0), static_cast<uint16_t>(3600));
    if (oledPinConflicts(settings.oled, settings.audio, settings.battery, settings.device)) {
        settings.oled.enabled = false;
        settings.oled.sdaPin = DefaultConfig::OLED_SDA_PIN;
        settings.oled.sclPin = DefaultConfig::OLED_SCL_PIN;
        settings.oled.resetPin = DefaultConfig::OLED_RESET_PIN;
    }
    if (!isValidWapeTriggerPin(settings.oled.wapeTriggerPin) || wapeTriggerPinConflicts(settings.oled, settings.audio, settings.battery, settings.device)) {
        settings.oled.wapeTriggerPin = 0;
    }
    settings.oled.wapeTriggerEvent = normalizeWapeTriggerEvent(settings.oled.wapeTriggerEvent);
    settings.usingSavedSettings = input.usingSavedSettings;
    return settings;
}

SettingsBundle SettingsManager::load() {
    SettingsBundle settings = defaults();
    settings.usingSavedSettings = readBool(PREF_MARKER, false);
    if (!settings.usingSavedSettings) {
        settings.mqtt.clientId = settings.device.deviceName;
        return sanitize(settings);
    }

    settings.wifi.ssid = readString("wifi_ssid", settings.wifi.ssid);
    settings.wifi.password = readString("wifi_pass", settings.wifi.password);
    settings.wifi.apSsid = readString("wifi_apssid", settings.wifi.apSsid);
    settings.wifi.apPassword = readString("wifi_appass", settings.wifi.apPassword);
    settings.wifi.apFallbackEnabled = readBool("wifi_apfb", settings.wifi.apFallbackEnabled);
    settings.wifi.useStaticIp = readBool("wifi_static", settings.wifi.useStaticIp);
    settings.wifi.staticIp = readString("wifi_ip", settings.wifi.staticIp);
    settings.wifi.gateway = readString("wifi_gw", settings.wifi.gateway);
    settings.wifi.subnet = readString("wifi_sub", settings.wifi.subnet);
    settings.wifi.dns1 = readString("wifi_dns1", settings.wifi.dns1);
    settings.wifi.dns2 = readString("wifi_dns2", settings.wifi.dns2);

    settings.mqtt.host = readString("mqtt_host", settings.mqtt.host);
    settings.mqtt.port = readUInt("mqtt_port", settings.mqtt.port);
    settings.mqtt.username = readString("mqtt_user", settings.mqtt.username);
    settings.mqtt.password = readString("mqtt_pass", settings.mqtt.password);
    settings.mqtt.clientId = readString("mqtt_cid", settings.device.deviceName);
    settings.mqtt.baseTopic = readString("mqtt_base", settings.mqtt.baseTopic);
    settings.mqtt.discoveryEnabled = readBool("mqtt_disc", settings.mqtt.discoveryEnabled);

    settings.ota.owner = readString("ota_owner", settings.ota.owner);
    settings.ota.repository = readString("ota_repo", settings.ota.repository);
    settings.ota.channel = readString("ota_chan", settings.ota.channel);
    settings.ota.assetTemplate = readString("ota_asset", settings.ota.assetTemplate);
    settings.ota.manifestUrl = readString("ota_manifest", settings.ota.manifestUrl);
    settings.ota.allowInsecureTls = readBool("ota_tls", settings.ota.allowInsecureTls);
    settings.ota.autoCheck = readBool("ota_auto", settings.ota.autoCheck);

    settings.battery.calibrationMultiplier = readFloat("bat_cal", settings.battery.calibrationMultiplier);
    settings.battery.adcPin = readUInt("bat_pin", settings.battery.adcPin);
    settings.battery.chargingSensePin = readUInt("bat_chg", settings.battery.chargingSensePin);
    settings.battery.updateIntervalMs = readUInt("bat_int", settings.battery.updateIntervalMs);
    settings.battery.movingAverageWindowSize = readUInt("bat_win", readUInt("bat_samp", settings.battery.movingAverageWindowSize));

    settings.webAuth.enabled = readBool("web_auth", settings.webAuth.enabled);
    settings.webAuth.username = readString("web_user", settings.webAuth.username);
    settings.webAuth.password = readString("web_pass", settings.webAuth.password);

    settings.audio.doutPin = readUInt("aud_dout", settings.audio.doutPin);
    settings.audio.wsPin = readUInt("aud_ws", settings.audio.wsPin);
    settings.audio.bclkPin = readUInt("aud_bclk", settings.audio.bclkPin);

    settings.oled.enabled = readBool("oled_en", settings.oled.enabled);
    settings.oled.displayType = readString("oled_mode", settings.oled.displayType);
    settings.oled.driver = readString("oled_drv", settings.oled.driver);
    settings.oled.i2cAddress = readUInt("oled_addr", settings.oled.i2cAddress);
    settings.oled.width = readUInt("oled_w", settings.oled.width);
    settings.oled.height = readUInt("oled_h", settings.oled.height);
    settings.oled.rotation = readUInt("oled_rot", settings.oled.rotation);
    settings.oled.sdaPin = readUInt("oled_sda", settings.oled.sdaPin);
    settings.oled.sclPin = readUInt("oled_scl", settings.oled.sclPin);
    settings.oled.resetPin = readInt("oled_rst", settings.oled.resetPin);
    settings.oled.dimTimeoutSeconds = readUInt("oled_dim", settings.oled.dimTimeoutSeconds);
    settings.oled.wapeTriggerPin = readUInt("oled_wape_pin", settings.oled.wapeTriggerPin);
    settings.oled.wapeTriggerEvent = readString("oled_wape_evt", settings.oled.wapeTriggerEvent);

    settings.device.deviceName = readString("dev_name", settings.device.deviceName);
    settings.device.friendlyName = readString("dev_friendly", settings.device.friendlyName);
    settings.device.statusLedPin = readUInt("dev_led", settings.device.statusLedPin);
    settings.device.savedVolumePercent = readUInt("dev_vol", settings.device.savedVolumePercent);
    settings.device.audioMuted = readBool("dev_muted", settings.device.audioMuted);
    settings.device.button1Action = readString("dev_btn1", settings.device.button1Action);
    settings.device.button2Action = readString("dev_btn2", settings.device.button2Action);
    settings.device.lowBatterySleepEnabled = readBool("dev_lbs_en", settings.device.lowBatterySleepEnabled);
    settings.device.lowBatterySleepThresholdPercent = readUInt("dev_lbs_pct", settings.device.lowBatterySleepThresholdPercent);
    settings.device.lowBatteryWakeIntervalMinutes = readUInt("dev_lbs_wk", settings.device.lowBatteryWakeIntervalMinutes);

    settings = sanitize(settings);
    settings.mqtt.clientId = fallbackIfEmpty(settings.mqtt.clientId, settings.device.deviceName);
    settings.usingSavedSettings = true;
    return settings;
}

bool SettingsManager::save(const SettingsBundle& settings) {
    const SettingsBundle sanitized = sanitize(settings);
    bool changed = false;
    changed |= writeStringIfChanged("wifi_ssid", sanitized.wifi.ssid);
    changed |= writeStringIfChanged("wifi_pass", sanitized.wifi.password);
    changed |= writeStringIfChanged("wifi_apssid", sanitized.wifi.apSsid);
    changed |= writeStringIfChanged("wifi_appass", sanitized.wifi.apPassword);
    changed |= writeBoolIfChanged("wifi_apfb", sanitized.wifi.apFallbackEnabled);
    changed |= writeBoolIfChanged("wifi_static", sanitized.wifi.useStaticIp);
    changed |= writeStringIfChanged("wifi_ip", sanitized.wifi.staticIp);
    changed |= writeStringIfChanged("wifi_gw", sanitized.wifi.gateway);
    changed |= writeStringIfChanged("wifi_sub", sanitized.wifi.subnet);
    changed |= writeStringIfChanged("wifi_dns1", sanitized.wifi.dns1);
    changed |= writeStringIfChanged("wifi_dns2", sanitized.wifi.dns2);

    changed |= writeStringIfChanged("mqtt_host", sanitized.mqtt.host);
    changed |= writeUIntIfChanged("mqtt_port", sanitized.mqtt.port);
    changed |= writeStringIfChanged("mqtt_user", sanitized.mqtt.username);
    changed |= writeStringIfChanged("mqtt_pass", sanitized.mqtt.password);
    changed |= writeStringIfChanged("mqtt_cid", fallbackIfEmpty(sanitized.mqtt.clientId, sanitized.device.deviceName));
    changed |= writeStringIfChanged("mqtt_base", sanitized.mqtt.baseTopic);
    changed |= writeBoolIfChanged("mqtt_disc", sanitized.mqtt.discoveryEnabled);

    changed |= writeStringIfChanged("ota_owner", sanitized.ota.owner);
    changed |= writeStringIfChanged("ota_repo", sanitized.ota.repository);
    changed |= writeStringIfChanged("ota_chan", sanitized.ota.channel);
    changed |= writeStringIfChanged("ota_asset", sanitized.ota.assetTemplate);
    changed |= writeStringIfChanged("ota_manifest", sanitized.ota.manifestUrl);
    changed |= writeBoolIfChanged("ota_tls", sanitized.ota.allowInsecureTls);
    changed |= writeBoolIfChanged("ota_auto", sanitized.ota.autoCheck);

    changed |= writeFloatIfChanged("bat_cal", sanitized.battery.calibrationMultiplier);
    changed |= writeUIntIfChanged("bat_pin", sanitized.battery.adcPin);
    changed |= writeUIntIfChanged("bat_chg", sanitized.battery.chargingSensePin);
    changed |= writeUIntIfChanged("bat_int", sanitized.battery.updateIntervalMs);
    changed |= writeUIntIfChanged("bat_win", sanitized.battery.movingAverageWindowSize);

    changed |= writeBoolIfChanged("web_auth", sanitized.webAuth.enabled);
    changed |= writeStringIfChanged("web_user", sanitized.webAuth.username);
    changed |= writeStringIfChanged("web_pass", sanitized.webAuth.password);

    changed |= writeUIntIfChanged("aud_dout", sanitized.audio.doutPin);
    changed |= writeUIntIfChanged("aud_ws", sanitized.audio.wsPin);
    changed |= writeUIntIfChanged("aud_bclk", sanitized.audio.bclkPin);

    changed |= writeBoolIfChanged("oled_en", sanitized.oled.enabled);
    changed |= writeStringIfChanged("oled_mode", sanitized.oled.displayType);
    changed |= writeStringIfChanged("oled_drv", sanitized.oled.driver);
    changed |= writeUIntIfChanged("oled_addr", sanitized.oled.i2cAddress);
    changed |= writeUIntIfChanged("oled_w", sanitized.oled.width);
    changed |= writeUIntIfChanged("oled_h", sanitized.oled.height);
    changed |= writeUIntIfChanged("oled_rot", sanitized.oled.rotation);
    changed |= writeUIntIfChanged("oled_sda", sanitized.oled.sdaPin);
    changed |= writeUIntIfChanged("oled_scl", sanitized.oled.sclPin);
    changed |= writeIntIfChanged("oled_rst", sanitized.oled.resetPin);
    changed |= writeUIntIfChanged("oled_dim", sanitized.oled.dimTimeoutSeconds);
    changed |= writeUIntIfChanged("oled_wape_pin", sanitized.oled.wapeTriggerPin);
    changed |= writeStringIfChanged("oled_wape_evt", sanitized.oled.wapeTriggerEvent);

    changed |= writeStringIfChanged("dev_name", sanitized.device.deviceName);
    changed |= writeStringIfChanged("dev_friendly", sanitized.device.friendlyName);
    changed |= writeUIntIfChanged("dev_led", sanitized.device.statusLedPin);
    changed |= writeUIntIfChanged("dev_vol", sanitized.device.savedVolumePercent);
    changed |= writeBoolIfChanged("dev_muted", sanitized.device.audioMuted);
    changed |= writeStringIfChanged("dev_btn1", sanitized.device.button1Action);
    changed |= writeStringIfChanged("dev_btn2", sanitized.device.button2Action);
    changed |= writeBoolIfChanged("dev_lbs_en", sanitized.device.lowBatterySleepEnabled);
    changed |= writeUIntIfChanged("dev_lbs_pct", sanitized.device.lowBatterySleepThresholdPercent);
    changed |= writeUIntIfChanged("dev_lbs_wk", sanitized.device.lowBatteryWakeIntervalMinutes);
    changed |= writeBoolIfChanged(PREF_MARKER, true);
    return changed;
}

bool SettingsManager::reset() {
    return preferences_.clear();
}

void SettingsManager::toJson(const SettingsBundle& settings, JsonObject root) const {
    JsonObject wifi = root["wifi"].to<JsonObject>();
    wifi["ssid"] = settings.wifi.ssid;
    wifi["password"] = settings.wifi.password;
    wifi["apSsid"] = settings.wifi.apSsid;
    wifi["apPassword"] = settings.wifi.apPassword;
    wifi["apFallbackEnabled"] = settings.wifi.apFallbackEnabled;
    wifi["useStaticIp"] = settings.wifi.useStaticIp;
    wifi["staticIp"] = settings.wifi.staticIp;
    wifi["gateway"] = settings.wifi.gateway;
    wifi["subnet"] = settings.wifi.subnet;
    wifi["dns1"] = settings.wifi.dns1;
    wifi["dns2"] = settings.wifi.dns2;

    JsonObject mqtt = root["mqtt"].to<JsonObject>();
    mqtt["host"] = settings.mqtt.host;
    mqtt["port"] = settings.mqtt.port;
    mqtt["username"] = settings.mqtt.username;
    mqtt["password"] = settings.mqtt.password;
    mqtt["clientId"] = settings.mqtt.clientId;
    mqtt["baseTopic"] = settings.mqtt.baseTopic;
    mqtt["discoveryEnabled"] = settings.mqtt.discoveryEnabled;

    JsonObject ota = root["ota"].to<JsonObject>();
    ota["owner"] = settings.ota.owner;
    ota["repository"] = settings.ota.repository;
    ota["channel"] = settings.ota.channel;
    ota["assetTemplate"] = settings.ota.assetTemplate;
    ota["manifestUrl"] = settings.ota.manifestUrl;
    ota["allowInsecureTls"] = settings.ota.allowInsecureTls;
    ota["autoCheck"] = settings.ota.autoCheck;

    JsonObject battery = root["battery"].to<JsonObject>();
    battery["calibrationMultiplier"] = settings.battery.calibrationMultiplier;
    battery["adcPin"] = settings.battery.adcPin;
    battery["chargingSensePin"] = settings.battery.chargingSensePin;
    battery["updateIntervalMs"] = settings.battery.updateIntervalMs;
    battery["movingAverageWindowSize"] = settings.battery.movingAverageWindowSize;

    JsonObject webAuth = root["webAuth"].to<JsonObject>();
    webAuth["enabled"] = settings.webAuth.enabled;
    webAuth["username"] = settings.webAuth.username;
    webAuth["password"] = settings.webAuth.password;

    JsonObject audio = root["audio"].to<JsonObject>();
    audio["doutPin"] = settings.audio.doutPin;
    audio["wsPin"] = settings.audio.wsPin;
    audio["bclkPin"] = settings.audio.bclkPin;

    JsonObject oled = root["oled"].to<JsonObject>();
    oled["enabled"] = settings.oled.enabled;
    oled["displayType"] = settings.oled.displayType;
    oled["driver"] = settings.oled.driver;
    oled["i2cAddress"] = settings.oled.i2cAddress;
    oled["width"] = settings.oled.width;
    oled["height"] = settings.oled.height;
    oled["rotation"] = settings.oled.rotation;
    oled["sdaPin"] = settings.oled.sdaPin;
    oled["sclPin"] = settings.oled.sclPin;
    oled["resetPin"] = settings.oled.resetPin;
    oled["dimTimeoutSeconds"] = settings.oled.dimTimeoutSeconds;
    oled["wapeTriggerPin"] = settings.oled.wapeTriggerPin;
    oled["wapeTriggerEvent"] = settings.oled.wapeTriggerEvent;

    JsonObject device = root["device"].to<JsonObject>();
    device["deviceName"] = settings.device.deviceName;
    device["friendlyName"] = settings.device.friendlyName;
    device["statusLedPin"] = settings.device.statusLedPin;
    device["savedVolumePercent"] = settings.device.savedVolumePercent;
    device["audioMuted"] = settings.device.audioMuted;
    device["button1Action"] = settings.device.button1Action;
    device["button2Action"] = settings.device.button2Action;
    device["lowBatterySleepEnabled"] = settings.device.lowBatterySleepEnabled;
    device["lowBatterySleepThresholdPercent"] = settings.device.lowBatterySleepThresholdPercent;
    device["lowBatteryWakeIntervalMinutes"] = settings.device.lowBatteryWakeIntervalMinutes;
    root["usingSavedSettings"] = settings.usingSavedSettings;
}

bool SettingsManager::updateFromJson(SettingsBundle& settings, JsonVariantConst root, String& error) const {
    if (!root.is<JsonObjectConst>()) {
        error = "Expected JSON object";
        return false;
    }

    JsonObjectConst object = root.as<JsonObjectConst>();
    auto copyString = [](JsonObjectConst section, const char* key, String& target) {
        if (section[key].is<const char*>()) {
            target = section[key].as<const char*>();
        }
    };

    JsonObjectConst wifi = object["wifi"];
    if (!wifi.isNull()) {
        copyString(wifi, "ssid", settings.wifi.ssid);
        copyString(wifi, "password", settings.wifi.password);
        copyString(wifi, "apSsid", settings.wifi.apSsid);
        copyString(wifi, "apPassword", settings.wifi.apPassword);
        copyString(wifi, "staticIp", settings.wifi.staticIp);
        copyString(wifi, "gateway", settings.wifi.gateway);
        copyString(wifi, "subnet", settings.wifi.subnet);
        copyString(wifi, "dns1", settings.wifi.dns1);
        copyString(wifi, "dns2", settings.wifi.dns2);
        if (wifi["apFallbackEnabled"].is<bool>()) settings.wifi.apFallbackEnabled = wifi["apFallbackEnabled"].as<bool>();
        if (wifi["useStaticIp"].is<bool>()) settings.wifi.useStaticIp = wifi["useStaticIp"].as<bool>();
    }

    JsonObjectConst mqtt = object["mqtt"];
    if (!mqtt.isNull()) {
        copyString(mqtt, "host", settings.mqtt.host);
        copyString(mqtt, "username", settings.mqtt.username);
        copyString(mqtt, "password", settings.mqtt.password);
        copyString(mqtt, "clientId", settings.mqtt.clientId);
        copyString(mqtt, "baseTopic", settings.mqtt.baseTopic);
        if (mqtt["port"].is<uint16_t>()) settings.mqtt.port = mqtt["port"].as<uint16_t>();
        if (mqtt["discoveryEnabled"].is<bool>()) settings.mqtt.discoveryEnabled = mqtt["discoveryEnabled"].as<bool>();
    }

    JsonObjectConst ota = object["ota"];
    if (!ota.isNull()) {
        copyString(ota, "owner", settings.ota.owner);
        copyString(ota, "repository", settings.ota.repository);
        copyString(ota, "channel", settings.ota.channel);
        copyString(ota, "assetTemplate", settings.ota.assetTemplate);
        copyString(ota, "manifestUrl", settings.ota.manifestUrl);
        if (ota["allowInsecureTls"].is<bool>()) settings.ota.allowInsecureTls = ota["allowInsecureTls"].as<bool>();
        if (ota["autoCheck"].is<bool>()) settings.ota.autoCheck = ota["autoCheck"].as<bool>();
    }

    JsonObjectConst battery = object["battery"];
    if (!battery.isNull()) {
        if (battery["calibrationMultiplier"].is<float>()) settings.battery.calibrationMultiplier = battery["calibrationMultiplier"].as<float>();
        if (battery["adcPin"].is<uint8_t>()) settings.battery.adcPin = battery["adcPin"].as<uint8_t>();
        if (battery["chargingSensePin"].is<uint8_t>()) settings.battery.chargingSensePin = battery["chargingSensePin"].as<uint8_t>();
        if (battery["updateIntervalMs"].is<uint32_t>()) settings.battery.updateIntervalMs = battery["updateIntervalMs"].as<uint32_t>();
        if (battery["movingAverageWindowSize"].is<uint16_t>()) settings.battery.movingAverageWindowSize = battery["movingAverageWindowSize"].as<uint16_t>();
        if (battery["sampleCount"].is<uint16_t>()) settings.battery.movingAverageWindowSize = battery["sampleCount"].as<uint16_t>();
    }

    JsonObjectConst webAuth = object["webAuth"];
    if (!webAuth.isNull()) {
        copyString(webAuth, "username", settings.webAuth.username);
        copyString(webAuth, "password", settings.webAuth.password);
        if (webAuth["enabled"].is<bool>()) settings.webAuth.enabled = webAuth["enabled"].as<bool>();
    }

    JsonObjectConst audio = object["audio"];
    if (!audio.isNull()) {
        if (audio["doutPin"].is<uint8_t>()) settings.audio.doutPin = audio["doutPin"].as<uint8_t>();
        if (audio["wsPin"].is<uint8_t>()) settings.audio.wsPin = audio["wsPin"].as<uint8_t>();
        if (audio["bclkPin"].is<uint8_t>()) settings.audio.bclkPin = audio["bclkPin"].as<uint8_t>();
    }

    JsonObjectConst oled = object["oled"];
    if (!oled.isNull()) {
        copyString(oled, "displayType", settings.oled.displayType);
        copyString(oled, "driver", settings.oled.driver);
        if (oled["enabled"].is<bool>()) settings.oled.enabled = oled["enabled"].as<bool>();
        if (oled["i2cAddress"].is<uint8_t>()) settings.oled.i2cAddress = oled["i2cAddress"].as<uint8_t>();
        if (oled["width"].is<uint8_t>()) settings.oled.width = oled["width"].as<uint8_t>();
        if (oled["height"].is<uint8_t>()) settings.oled.height = oled["height"].as<uint8_t>();
        if (oled["rotation"].is<uint16_t>()) settings.oled.rotation = oled["rotation"].as<uint16_t>();
        if (oled["sdaPin"].is<uint8_t>()) settings.oled.sdaPin = oled["sdaPin"].as<uint8_t>();
        if (oled["sclPin"].is<uint8_t>()) settings.oled.sclPin = oled["sclPin"].as<uint8_t>();
        if (oled["resetPin"].is<int8_t>()) settings.oled.resetPin = oled["resetPin"].as<int8_t>();
        if (oled["dimTimeoutSeconds"].is<uint16_t>()) settings.oled.dimTimeoutSeconds = oled["dimTimeoutSeconds"].as<uint16_t>();
        if (oled["wapeTriggerPin"].is<uint8_t>()) settings.oled.wapeTriggerPin = oled["wapeTriggerPin"].as<uint8_t>();
        copyString(oled, "wapeTriggerEvent", settings.oled.wapeTriggerEvent);
    }

    JsonObjectConst device = object["device"];
    if (!device.isNull()) {
        copyString(device, "deviceName", settings.device.deviceName);
        copyString(device, "friendlyName", settings.device.friendlyName);
        copyString(device, "button1Action", settings.device.button1Action);
        copyString(device, "button2Action", settings.device.button2Action);
        if (device["statusLedPin"].is<uint8_t>()) settings.device.statusLedPin = device["statusLedPin"].as<uint8_t>();
        if (device["savedVolumePercent"].is<uint8_t>()) settings.device.savedVolumePercent = device["savedVolumePercent"].as<uint8_t>();
        if (device["audioMuted"].is<bool>()) settings.device.audioMuted = device["audioMuted"].as<bool>();
        if (device["lowBatterySleepEnabled"].is<bool>()) settings.device.lowBatterySleepEnabled = device["lowBatterySleepEnabled"].as<bool>();
        if (device["lowBatterySleepThresholdPercent"].is<uint8_t>()) settings.device.lowBatterySleepThresholdPercent = device["lowBatterySleepThresholdPercent"].as<uint8_t>();
        if (device["lowBatteryWakeIntervalMinutes"].is<uint16_t>()) settings.device.lowBatteryWakeIntervalMinutes = device["lowBatteryWakeIntervalMinutes"].as<uint16_t>();
    }

    settings = sanitize(settings);
    return true;
}

bool SettingsManager::writeStringIfChanged(const char* key, const String& value) {
    if (preferences_.isKey(key) && preferences_.getString(key, "") == value) {
        return false;
    }
    preferences_.putString(key, value);
    return true;
}

bool SettingsManager::writeBoolIfChanged(const char* key, bool value) {
    if (preferences_.isKey(key) && preferences_.getBool(key, !value) == value) {
        return false;
    }
    preferences_.putBool(key, value);
    return true;
}

bool SettingsManager::writeUIntIfChanged(const char* key, uint32_t value) {
    if (preferences_.isKey(key) && preferences_.getUInt(key, value + 1) == value) {
        return false;
    }
    preferences_.putUInt(key, value);
    return true;
}

bool SettingsManager::writeIntIfChanged(const char* key, int32_t value) {
    if (preferences_.isKey(key) && preferences_.getInt(key, value + 1) == value) {
        return false;
    }
    preferences_.putInt(key, value);
    return true;
}

bool SettingsManager::writeFloatIfChanged(const char* key, float value) {
    if (preferences_.isKey(key) && fabsf(preferences_.getFloat(key, value + 1.0f) - value) < 0.0001f) {
        return false;
    }
    preferences_.putFloat(key, value);
    return true;
}

String SettingsManager::readString(const char* key, const String& fallback) {
    if (!preferences_.isKey(key)) {
        return fallback;
    }
    return preferences_.getString(key, fallback);
}

bool SettingsManager::readBool(const char* key, bool fallback) {
    if (!preferences_.isKey(key)) {
        return fallback;
    }
    return preferences_.getBool(key, fallback);
}

uint32_t SettingsManager::readUInt(const char* key, uint32_t fallback) {
    if (!preferences_.isKey(key)) {
        return fallback;
    }
    return preferences_.getUInt(key, fallback);
}

int32_t SettingsManager::readInt(const char* key, int32_t fallback) {
    if (!preferences_.isKey(key)) {
        return fallback;
    }
    return preferences_.getInt(key, fallback);
}

float SettingsManager::readFloat(const char* key, float fallback) {
    if (!preferences_.isKey(key)) {
        return fallback;
    }
    return preferences_.getFloat(key, fallback);
}
