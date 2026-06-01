#include "mqtt_manager.h"

#include "version.h"

namespace {
String payloadToString(char* payload, size_t len) {
    String value;
    value.reserve(len);
    for (size_t index = 0; index < len; ++index) {
        value += payload[index];
    }
    return value;
}

bool mqttReconnectRequired(const SettingsBundle& current, const SettingsBundle& next) {
    return current.mqtt.host != next.mqtt.host ||
           current.mqtt.port != next.mqtt.port ||
           current.mqtt.username != next.mqtt.username ||
           current.mqtt.password != next.mqtt.password ||
           current.mqtt.clientId != next.mqtt.clientId ||
           current.mqtt.baseTopic != next.mqtt.baseTopic ||
           current.device.deviceName != next.device.deviceName;
}

uint8_t batteryPercentFromVoltage(float voltage) {
    if (!isfinite(voltage) || voltage <= 0.0f) {
        return 0;
    }
    const float clamped = voltage < 3.2f ? 3.2f : (voltage > 4.2f ? 4.2f : voltage);
    return static_cast<uint8_t>(((clamped - 3.2f) / (4.2f - 3.2f) * 100.0f) + 0.5f);
}

const char* mqttBinaryPayload(bool enabled) {
    return enabled ? "ON" : "OFF";
}

String normalizeMediaType(const String& value, bool announce) {
    String mediaType = value;
    mediaType.trim();
    mediaType.toLowerCase();

    if (announce || mediaType.indexOf("tts") >= 0 || mediaType.indexOf("announce") >= 0 || mediaType.indexOf("speech") >= 0) {
        return "tts";
    }

    if (mediaType.isEmpty()) {
        return "stream";
    }

    if (mediaType == "music" || mediaType == "audio" || mediaType == "stream" || mediaType == "media" || mediaType == "radio") {
        return "stream";
    }

    return mediaType;
}

uint8_t percentFromVolumeLevel(float level) {
    const float clamped = level < 0.0f ? 0.0f : (level > 1.0f ? 1.0f : level);
    return static_cast<uint8_t>((clamped * 100.0f) + 0.5f);
}

#ifdef APP_ENABLE_HACS_MQTT
[[maybe_unused]]
String normalizedHacsPlaybackState(const String& value) {
    String state = value;
    state.trim();
    state.toLowerCase();

    if (state == "buffering") {
        return "playing";
    }

    if (state == "playing" || state == "paused" || state == "idle" || state == "off" || state == "stopped") {
        return state;
    }

    return "idle";
}

[[maybe_unused]]
String normalizedHacsMediaType(const String& value) {
    String mediaType = value;
    mediaType.trim();
    mediaType.toLowerCase();

    if (mediaType == "tts" || mediaType == "speech" || mediaType == "announce") {
        return "music";
    }

    if (mediaType.isEmpty() || mediaType == "idle" || mediaType == "stream" || mediaType == "radio" || mediaType == "audio") {
        return "music";
    }

    return mediaType;
}

[[maybe_unused]]
String hacsVolumePayload(uint8_t volumePercent) {
    char buffer[8];
    snprintf(buffer, sizeof(buffer), "%.2f", static_cast<float>(volumePercent) / 100.0f);
    return String(buffer);
}
#endif
}  // namespace

void MqttManager::begin(const SettingsBundle& settings, AppState& appState, WiFiManager& wifiManager, OtaManager& otaManager, CommandHandler commandHandler) {
    appState_ = &appState;
    wifiManager_ = &wifiManager;
    otaManager_ = &otaManager;
    commandHandler_ = commandHandler;
    wifiWasConnected_ = wifiManager.isConnected();

    client_.onConnect([this](bool sessionPresent) { handleConnected(sessionPresent); });
    client_.onDisconnect([this](AsyncMqttClientDisconnectReason reason) { handleDisconnected(reason); });
    client_.onSubscribe([this](uint16_t, uint8_t) { noteBrokerActivity(); });
    client_.onPublish([this](uint16_t) { noteBrokerActivity(); });
    client_.onMessage([this](char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total) {
        handleMessage(topic, payload, properties, len, index, total);
    });
    applySettings(settings);
}

void MqttManager::applySettings(const SettingsBundle& settings) {
    const bool discoverySettingsChanged = !configured_ ||
        settings_.mqtt.discoveryEnabled != settings.mqtt.discoveryEnabled ||
        settings_.device.friendlyName != settings.device.friendlyName ||
        settings_.mqtt.baseTopic != settings.mqtt.baseTopic;
    const bool needsReconfigure = !configured_ || mqttReconnectRequired(settings_, settings) || !client_.connected();
    settings_ = settings;
    if (settings_.mqtt.host.isEmpty()) {
        consecutiveFailureCount_ = 0;
        recoveryRebootRecommended_ = false;
    }
    if (discoverySettingsChanged) {
        discoveryPublishedForSession_ = false;
    }
    if (needsReconfigure) {
        configureClient();
        configured_ = true;
        return;
    }

    if (client_.connected()) {
        if (settings_.mqtt.discoveryEnabled && !discoveryPublishedForSession_) {
            discoveryPublishPending_ = true;
        }
        statePublishPending_ = true;
    }
}

void MqttManager::configureClient() {
    client_.disconnect(true);
    client_.setServer(settings_.mqtt.host.c_str(), settings_.mqtt.port);
    client_.setClientId(settings_.mqtt.clientId.isEmpty() ? settings_.device.deviceName.c_str() : settings_.mqtt.clientId.c_str());
    client_.setCredentials(
        settings_.mqtt.username.isEmpty() ? nullptr : settings_.mqtt.username.c_str(),
        settings_.mqtt.username.isEmpty() ? nullptr : settings_.mqtt.password.c_str());
    client_.setKeepAlive(MQTT_KEEP_ALIVE_SECONDS);
    client_.setCleanSession(true);
    client_.setWill(HaBridge::availabilityTopic(settings_).c_str(), 1, true, "offline");
    lastConnectAttemptAt_ = 0;
    lastBrokerActivityAt_ = 0;
    if (settings_.mqtt.host.isEmpty()) {
        consecutiveFailureCount_ = 0;
        recoveryRebootRecommended_ = false;
    }

    if (!connectionEnabled_) {
        return;
    }

    if (!settings_.mqtt.host.isEmpty() && wifiManager_ != nullptr && wifiManager_->isConnected()) {
        Serial.printf("[mqtt] immediate reconnect attempt %u/%u to %s:%u\n",
                  static_cast<unsigned>(min<uint8_t>(static_cast<uint8_t>(consecutiveFailureCount_ + 1), MQTT_MAX_CONSECUTIVE_FAILURES)),
                      static_cast<unsigned>(MQTT_MAX_CONSECUTIVE_FAILURES),
                      settings_.mqtt.host.c_str(), settings_.mqtt.port);
        lastConnectAttemptAt_ = millis();
        client_.connect();
    }
}

void MqttManager::loop() {
    handleWiFiState();
    connectIfNeeded();
    if (client_.connected()) {
        if (discoveryPublishPending_ && settings_.mqtt.discoveryEnabled) {
            publishDiscovery();
            discoveryPublishPending_ = false;
            discoveryPublishedForSession_ = true;
        }
        if (statePublishPending_) {
            publishState();
            statePublishPending_ = false;
        }
    }
    if (client_.connected() && lastBrokerActivityAt_ != 0 && millis() - lastBrokerActivityAt_ > MQTT_STALE_CONNECTION_MS) {
        Serial.printf("[mqtt] no broker activity for %lu ms, forcing reconnect\n",
                      static_cast<unsigned long>(MQTT_STALE_CONNECTION_MS));
        lastConnectAttemptAt_ = 0;
        client_.disconnect(true);
        return;
    }
    if (isConnected() && millis() - lastStatePublishAt_ > 30000UL) {
        publishState();
    }
}

void MqttManager::connectIfNeeded() {
    if (!connectionEnabled_ || settings_.mqtt.host.isEmpty() || wifiManager_ == nullptr || !wifiManager_->isConnected() || client_.connected()) {
        return;
    }
    if (millis() - lastConnectAttemptAt_ < MQTT_RETRY_INTERVAL_MS) {
        return;
    }
    configureClient();
}

void MqttManager::handleWiFiState() {
    if (wifiManager_ == nullptr) {
        return;
    }

    const bool wifiConnected = wifiManager_->isConnected();
    if (wifiConnected == wifiWasConnected_) {
        return;
    }

    wifiWasConnected_ = wifiConnected;
    if (!wifiConnected) {
        discoveryPublishedForSession_ = false;
        lastOtaDiscoverySignature_ = "";
        lastBrokerActivityAt_ = 0;
        lastConnectAttemptAt_ = millis();
        if (client_.connected()) {
            Serial.println("[mqtt] Wi-Fi dropped, forcing MQTT disconnect");
            client_.disconnect(true);
        }
        return;
    }

    Serial.println("[mqtt] Wi-Fi restored, resetting MQTT session");
    discoveryPublishedForSession_ = false;
    lastOtaDiscoverySignature_ = "";
    lastConnectAttemptAt_ = 0;
    lastBrokerActivityAt_ = 0;
    client_.disconnect(true);
}

void MqttManager::handleConnected(bool sessionPresent) {
    (void)sessionPresent;
    Serial.printf("[mqtt] connected host=%s port=%u\n", settings_.mqtt.host.c_str(), settings_.mqtt.port);
    consecutiveFailureCount_ = 0;
    recoveryRebootRecommended_ = false;
    wifiWasConnected_ = wifiManager_ != nullptr && wifiManager_->isConnected();
    noteBrokerActivity();
    clearFrontendError();
    if (appState_ != nullptr) {
        appState_->setMqttConnected(true);
    }
    client_.publish(HaBridge::availabilityTopic(settings_).c_str(), 1, true, "online");
    client_.subscribe(HaBridge::commandTopic(settings_, "play").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "tts").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "stop").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "volume").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "display_trigger").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "alarm").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "notify").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "web_ui").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "reboot").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "ota/check").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "ota/auto_update").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "ota/install").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "ota/select_version").c_str(), 1);
    client_.subscribe(HaBridge::commandTopic(settings_, "ota/install_version").c_str(), 1);
#ifdef APP_ENABLE_HACS_MQTT
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "play").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "pause").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "playpause").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "next").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "previous").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "stop").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "volume").c_str(), 1);
    client_.subscribe(HaBridge::hacsMediaPlayerCommandTopic(settings_, "playmedia").c_str(), 1);
#endif
    if (settings_.mqtt.discoveryEnabled && !discoveryPublishedForSession_) {
        discoveryPublishPending_ = true;
    }
    statePublishPending_ = true;
}

void MqttManager::handleDisconnected(AsyncMqttClientDisconnectReason reason) {
    Serial.printf("[mqtt] disconnected reason=%d\n", static_cast<int>(reason));
    discoveryPublishedForSession_ = false;
    lastOtaDiscoverySignature_ = "";
    lastBrokerActivityAt_ = 0;
    if (appState_ != nullptr) {
        appState_->setMqttConnected(false);
    }
    registerFailedAttempt(reason);
}

void MqttManager::handleMessage(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total) {
    (void)properties;
    if (index != 0 || total != len || commandHandler_ == nullptr) {
        return;
    }

    noteBrokerActivity();

    const String topicValue = topic;
    const String payloadValue = payloadToString(payload, len);
    PlaybackCommand command;
#ifdef APP_ENABLE_HACS_MQTT
    if (topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "stop")) {
        command.action = "stop";
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "pause")) {
        command.action = "pause";
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "play") ||
        topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "playpause") ||
        topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "next") ||
        topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "previous")) {
        command.action = topicValue.substring(topicValue.lastIndexOf('/') + 1);
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "volume")) {
        command.action = "volume";
        command.volumePercent = payloadValue.indexOf('.') >= 0
            ? percentFromVolumeLevel(payloadValue.toFloat())
            : payloadValue.toInt();
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::hacsMediaPlayerCommandTopic(settings_, "playmedia")) {
        command.action = "play";
    }
#endif

    if (topicValue == HaBridge::commandTopic(settings_, "stop")) {
        command.action = "stop";
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "volume")) {
        command.action = "volume";
        if (payloadValue.startsWith("{")) {
            JsonDocument doc;
            if (deserializeJson(doc, payloadValue) == DeserializationError::Ok) {
                if (!doc["volumePercent"].isNull() || !doc["volume"].isNull()) {
                    command.volumePercent = doc["volumePercent"] | doc["volume"] | 0;
                } else if (!doc["volume_level"].isNull()) {
                    command.volumePercent = percentFromVolumeLevel(doc["volume_level"] | 0.0f);
                }
            }
        } else {
            command.volumePercent = payloadValue.indexOf('.') >= 0
                ? percentFromVolumeLevel(payloadValue.toFloat())
                : payloadValue.toInt();
        }
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "display_trigger")) {
        command.action = "display_trigger";
        command.payload = payloadValue;
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "alarm")) {
        String action = payloadValue;
        action.trim();
        action.toLowerCase();
        command.action = (action == "stop" || action == "off" || action == "0") ? "alarm_stop" : "alarm_start";
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "notify")) {
        command.action = "notify";
        command.payload = payloadValue;
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "web_ui")) {
        String action = payloadValue;
        action.trim();
        action.toLowerCase();
        if (action == "unlock" || action == "on" || action == "start" || action == "enable") {
            command.action = "web_ui_unlock";
        } else {
            command.action = "web_ui_lock";
        }
        command.payload = payloadValue;
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "reboot")) {
        command.action = "reboot";
        command.payload = payloadValue;
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "ota/check")) {
        command.action = "ota_check";
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "ota/auto_update")) {
        command.action = "ota_auto_update";
        command.payload = payloadValue;
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "ota/install")) {
        if (payloadValue.isEmpty() || payloadValue.equalsIgnoreCase("install")) {
            command.action = "ota_install_selected";
        } else if (payloadValue.equalsIgnoreCase("latest")) {
            command.action = "ota_install_latest";
        } else if (payloadValue.startsWith("{")) {
            JsonDocument doc;
            if (deserializeJson(doc, payloadValue) == DeserializationError::Ok) {
                command.version = String(static_cast<const char*>(doc["version"] | doc["tag"] | ""));
                command.assetName = String(static_cast<const char*>(doc["assetName"] | doc["asset"] | ""));
            }
            command.action = command.version.isEmpty() ? "ota_install_selected" : "ota_install";
        } else {
            command.action = "ota_install";
            command.version = payloadValue;
        }
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "ota/select_version")) {
        command.action = "ota_select_version";
        if (payloadValue.startsWith("{")) {
            JsonDocument doc;
            if (deserializeJson(doc, payloadValue) == DeserializationError::Ok) {
                command.label = String(static_cast<const char*>(doc["option"] | doc["label"] | ""));
            }
        } else {
            command.label = payloadValue;
        }
        commandHandler_(command);
        return;
    }

    if (topicValue == HaBridge::commandTopic(settings_, "ota/install_version")) {
        command.action = "ota_install";
        if (payloadValue.startsWith("{")) {
            JsonDocument doc;
            if (deserializeJson(doc, payloadValue) == DeserializationError::Ok) {
                command.version = String(static_cast<const char*>(doc["version"] | doc["tag"] | ""));
                command.assetName = String(static_cast<const char*>(doc["assetName"] | doc["asset"] | ""));
            }
        } else {
            command.version = payloadValue;
        }
        commandHandler_(command);
        return;
    }

    if (command.action.isEmpty()) {
        command.action = topicValue.endsWith("/tts") ? "tts" : "play";
    }
    if (payloadValue.startsWith("{")) {
        JsonDocument doc;
        if (deserializeJson(doc, payloadValue) == DeserializationError::Ok) {
            const bool announce = doc["announce"] | false;
            const String mediaContentType = String(static_cast<const char*>(doc["media_content_type"] | doc["media_type"] | ""));
            const String explicitType = String(static_cast<const char*>(doc["type"] | ""));
            command.url = String(static_cast<const char*>(doc["url"] | doc["media_content_id"] | doc["media_id"] | doc["mediaId"] | ""));
            command.label = String(static_cast<const char*>(doc["label"] | doc["title"] | doc["media_title"] | doc["extra"]["title"] | ""));
            command.source = String(static_cast<const char*>(doc["source"] | ""));
            command.mediaType = normalizeMediaType(
                explicitType.isEmpty() ? mediaContentType : explicitType,
                command.action == "tts" || announce);

            if (command.label.isEmpty() && !command.url.isEmpty()) {
                command.label = command.url;
            }
        }
    } else {
        command.url = payloadValue;
        command.mediaType = command.action == "tts" ? "tts" : "stream";
    }
    commandHandler_(command);
}

void MqttManager::publishJson(const String& topic, const JsonDocument& doc, bool retained) {
    if (!client_.connected()) {
        return;
    }
    String payload;
    serializeJson(doc, payload);
    client_.publish(topic.c_str(), 1, retained, payload.c_str());
    noteBrokerActivity();
}

String MqttManager::currentConfigUrl() const {
    if (appState_ != nullptr) {
        const AppStateSnapshot snapshot = appState_->snapshot();
        if (!snapshot.network.ip.isEmpty()) {
            return "http://" + snapshot.network.ip + "/";
        }
    }

    if (wifiManager_ != nullptr) {
        const String localIp = wifiManager_->localIp().toString();
        if (wifiManager_->isConnected() && localIp != "0.0.0.0") {
            return "http://" + localIp + "/";
        }

        const String apIp = wifiManager_->apIp().toString();
        if (wifiManager_->isApMode() && apIp != "0.0.0.0") {
            return "http://" + apIp + "/";
        }
    }

    return String();
}

void MqttManager::publishState() {
    if (!client_.connected() || appState_ == nullptr) {
        return;
    }
    lastStatePublishAt_ = millis();
    const AppStateSnapshot snapshot = appState_->snapshot();

    JsonDocument playback;
    playback["state"] = snapshot.playback.state;
    playback["type"] = snapshot.playback.type;
    playback["title"] = snapshot.playback.title;
    playback["url"] = snapshot.playback.url;
    playback["source"] = snapshot.playback.source;
    playback["volumePercent"] = snapshot.playback.volumePercent;
    publishJson(HaBridge::playbackStateTopic(settings_), playback, true);

    JsonDocument network;
    network["wifiConnected"] = snapshot.network.wifiConnected;
    network["apMode"] = snapshot.network.apMode;
    network["ip"] = snapshot.network.ip;
    network["ssid"] = snapshot.network.ssid;
    network["wifiRssi"] = snapshot.network.wifiRssi;
    network["mqttConnected"] = snapshot.network.mqttConnected;
    publishJson(HaBridge::networkStateTopic(settings_), network, true);

    JsonDocument battery;
    battery["voltage"] = snapshot.battery.voltage;
    battery["percent"] = batteryPercentFromVoltage(snapshot.battery.voltage);
    battery["rawAdcVoltage"] = snapshot.battery.rawAdcVoltage;
    battery["rawAdc"] = snapshot.battery.rawAdc;
    battery["charging"] = snapshot.battery.charging;
    publishJson(HaBridge::batteryStateTopic(settings_), battery, true);

    JsonDocument ota;
    if (otaManager_ != nullptr) {
        String error;
        otaManager_->appendFirmwareInfoJson(ota.to<JsonObject>(), false, error);
        if (!error.isEmpty()) {
            ota["error"] = error;
        }
    }
    ota["busy"] = snapshot.ota.busy;
    ota["updateAvailable"] = snapshot.ota.updateAvailable;
    ota["latestVersion"] = snapshot.ota.latestVersion;
    ota["lastResult"] = snapshot.ota.lastResult;
    ota["lastError"] = snapshot.ota.lastError;
    ota["phase"] = snapshot.ota.phase;
    ota["progressPercent"] = snapshot.ota.progressPercent;
    ota["currentVersion"] = APP_VERSION;
    ota["configUrl"] = currentConfigUrl();
    String otaDiscoverySignature = currentConfigUrl();
    otaDiscoverySignature += "|";
    otaDiscoverySignature += String(static_cast<const char*>(ota["selectedVersion"] | ""));
    otaDiscoverySignature += "|";
    otaDiscoverySignature += String(static_cast<const char*>(ota["selectedAssetName"] | ""));
    otaDiscoverySignature += "|";
    otaDiscoverySignature += String(static_cast<const char*>(ota["selectedOption"] | ""));
    otaDiscoverySignature += "|";
    otaDiscoverySignature += String(ota["compatibleReleaseCount"] | 0);
    if (ota["releaseOptions"].is<JsonArray>()) {
        for (JsonVariantConst option : ota["releaseOptions"].as<JsonArrayConst>()) {
            otaDiscoverySignature += "|";
            otaDiscoverySignature += String(static_cast<const char*>(option | ""));
        }
    }
    publishJson(HaBridge::otaStateTopic(settings_), ota, true);

    if (settings_.mqtt.discoveryEnabled && discoveryPublishedForSession_ && otaDiscoverySignature != lastOtaDiscoverySignature_) {
        publishDiscovery();
    }

    client_.publish((settings_.mqtt.baseTopic + "/state/volume").c_str(), 1, true, String(snapshot.playback.volumePercent).c_str());
    client_.publish((settings_.mqtt.baseTopic + "/state/battery_voltage").c_str(), 1, true, String(snapshot.battery.voltage, 3).c_str());
    client_.publish((settings_.mqtt.baseTopic + "/state/battery_percent").c_str(), 1, true, String(batteryPercentFromVoltage(snapshot.battery.voltage)).c_str());
    client_.publish((settings_.mqtt.baseTopic + "/state/battery_charging").c_str(), 1, true, mqttBinaryPayload(snapshot.battery.charging));
#ifdef APP_ENABLE_HACS_MQTT
    client_.publish(HaBridge::hacsMediaPlayerStateTopic(settings_, "state").c_str(), 1, true, normalizedHacsPlaybackState(snapshot.playback.state).c_str());
    client_.publish(HaBridge::hacsMediaPlayerStateTopic(settings_, "title").c_str(), 1, true, snapshot.playback.title.c_str());
    client_.publish(HaBridge::hacsMediaPlayerStateTopic(settings_, "mediatype").c_str(), 1, true, normalizedHacsMediaType(snapshot.playback.type).c_str());
    client_.publish(HaBridge::hacsMediaPlayerStateTopic(settings_, "volume").c_str(), 1, true, hacsVolumePayload(snapshot.playback.volumePercent).c_str());
#endif
}

void MqttManager::publishBattery(float voltage, float rawAdcVoltage, uint16_t rawAdc, bool charging) {
    if (!client_.connected()) {
        return;
    }
    JsonDocument battery;
    battery["voltage"] = voltage;
    battery["percent"] = batteryPercentFromVoltage(voltage);
    battery["rawAdcVoltage"] = rawAdcVoltage;
    battery["rawAdc"] = rawAdc;
    battery["charging"] = charging;
    publishJson(HaBridge::batteryStateTopic(settings_), battery, true);
    client_.publish((settings_.mqtt.baseTopic + "/state/battery_voltage").c_str(), 1, true, String(voltage, 3).c_str());
    client_.publish((settings_.mqtt.baseTopic + "/state/battery_percent").c_str(), 1, true, String(batteryPercentFromVoltage(voltage)).c_str());
    client_.publish((settings_.mqtt.baseTopic + "/state/battery_charging").c_str(), 1, true, mqttBinaryPayload(charging));
    noteBrokerActivity();
}

void MqttManager::publishDiscovery() {
    if (!client_.connected() || !settings_.mqtt.discoveryEnabled) {
        return;
    }
    const String configurationUrl = currentConfigUrl();
    std::vector<String> firmwareOptions;
    String otaDiscoverySignature = configurationUrl;
    if (otaManager_ != nullptr) {
        JsonDocument otaInfo;
        String ignoredError;
        otaManager_->appendFirmwareInfoJson(otaInfo.to<JsonObject>(), false, ignoredError);
        otaDiscoverySignature += "|";
        otaDiscoverySignature += String(static_cast<const char*>(otaInfo["selectedVersion"] | ""));
        otaDiscoverySignature += "|";
        otaDiscoverySignature += String(static_cast<const char*>(otaInfo["selectedAssetName"] | ""));
        otaDiscoverySignature += "|";
        otaDiscoverySignature += String(static_cast<const char*>(otaInfo["selectedOption"] | ""));
        otaDiscoverySignature += "|";
        otaDiscoverySignature += String(otaInfo["compatibleReleaseCount"] | 0);
        if (otaInfo["releaseOptions"].is<JsonArray>()) {
            for (JsonVariantConst option : otaInfo["releaseOptions"].as<JsonArrayConst>()) {
                const String optionValue = String(static_cast<const char*>(option | ""));
                firmwareOptions.push_back(optionValue);
                otaDiscoverySignature += "|";
                otaDiscoverySignature += optionValue;
            }
        }
    }
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "battery_voltage").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "battery_voltage", "Battery Voltage", HaBridge::batteryStateTopic(settings_).c_str(), "{{ value_json.voltage | float(0) | round(2) }}", "V", "voltage", "measurement", "mdi:battery", 2, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "battery_percent").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "battery_percent", "Battery", HaBridge::batteryStateTopic(settings_).c_str(), "{{ value_json.percent | int(0) }}", "%", "battery", "measurement", "mdi:battery-medium", 0, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "binary_sensor", "battery_charging").c_str(), 1, true,
        HaBridge::discoveryPayloadBinarySensor(settings_, "battery_charging", "Battery Charging", HaBridge::batteryStateTopic(settings_).c_str(), "{{ 'ON' if value_json.charging else 'OFF' }}", "battery_charging", "ON", "OFF", "mdi:battery-charging", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "wifi_rssi").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "wifi_rssi", "Wi-Fi RSSI", HaBridge::networkStateTopic(settings_).c_str(), "{{ value_json.wifiRssi }}", "dBm", "signal_strength", "measurement", "mdi:wifi", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "playback_state").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "playback_state", "Playback State", HaBridge::playbackStateTopic(settings_).c_str(), "{{ value_json.state }}", nullptr, nullptr, nullptr, "mdi:speaker-wireless", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_ota_status").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_ota_status", "Firmware OTA Status", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.updateStatus if value_json.busy and value_json.updateStatus else (value_json.phase if value_json.busy else (value_json.lastError if value_json.lastError else (value_json.lastResult if value_json.lastResult else value_json.updateStatus))) }}", nullptr, nullptr, nullptr, "mdi:update", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_installed_version").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_installed_version", "Installed Firmware", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.currentVersion if value_json.currentVersion else 'unknown' }}", nullptr, nullptr, nullptr, "mdi:chip", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_latest_version").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_latest_version", "Latest Compatible Firmware", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.latestVersion if value_json.latestVersion else (value_json.currentVersion if value_json.currentVersion else 'unknown') }}", nullptr, nullptr, nullptr, "mdi:source-branch", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_available_builds").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_available_builds", "Compatible Firmware Builds", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.latestAssetsSummary if value_json.latestAssetsSummary else (value_json.compatibleVersionsSummary if value_json.compatibleVersionsSummary else 'Run Check Firmware Releases') }}", nullptr, nullptr, nullptr, "mdi:format-list-bulleted", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_ota_progress").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_ota_progress", "Firmware OTA Progress", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.progressPercent | int(0) }}", "%", nullptr, nullptr, "mdi:progress-download", 0, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_last_rollback_version").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_last_rollback_version", "Last Rolled Back Firmware", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.rolledBackVersion if value_json.rolledBackVersion else '' }}", nullptr, nullptr, nullptr, "mdi:history", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "sensor", "firmware_last_rollback_reason").c_str(), 1, true,
        HaBridge::discoveryPayloadSensor(settings_, "firmware_last_rollback_reason", "Last Rollback Reason", HaBridge::otaStateTopic(settings_).c_str(), "{{ value_json.rollbackReason if value_json.rollbackReason else '' }}", nullptr, nullptr, nullptr, "mdi:alert-circle-outline", -1, configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "number", "volume").c_str(), 1, true,
        HaBridge::discoveryPayloadNumber(settings_, "volume", "Notifier Volume", (settings_.mqtt.baseTopic + "/state/volume").c_str(), HaBridge::commandTopic(settings_, "volume").c_str(), 0, 100, 1, "%", "mdi:volume-high", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "display_trigger").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "display_trigger", "Display Trigger", HaBridge::commandTopic(settings_, "display_trigger").c_str(), "trigger", "mdi:gesture-tap-button", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "alarm_trigger").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "alarm_trigger", "Alarm Trigger", HaBridge::commandTopic(settings_, "alarm").c_str(), "trigger", "mdi:alarm-bell", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "alarm_stop").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "alarm_stop", "Alarm Stop", HaBridge::commandTopic(settings_, "alarm").c_str(), "stop", "mdi:alarm-off", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "notify").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "notify", "Play Notification Cue", HaBridge::commandTopic(settings_, "notify").c_str(), "notify", "mdi:message-badge", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "reboot").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "reboot", "Reboot Device", HaBridge::commandTopic(settings_, "reboot").c_str(), "reboot", "mdi:restart", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "web_ui_lock").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "web_ui_lock", "Lock Web UI", HaBridge::commandTopic(settings_, "web_ui").c_str(), "lock", "mdi:web-off", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "web_ui_unlock").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "web_ui_unlock", "Unlock Web UI", HaBridge::commandTopic(settings_, "web_ui").c_str(), "unlock", "mdi:web-check", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "select", "firmware_version_select").c_str(), 1, true,
        HaBridge::discoveryPayloadSelect(settings_, "firmware_version_select", "Firmware Version", HaBridge::otaStateTopic(settings_).c_str(), HaBridge::commandTopic(settings_, "ota/select_version").c_str(), firmwareOptions, "mdi:format-list-bulleted-square", "{{ value_json.selectedOption if value_json.selectedOption else '' }}", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "stop").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "stop", "Stop Playback", HaBridge::commandTopic(settings_, "stop").c_str(), "stop", "mdi:stop", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "firmware_check").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "firmware_check", "Check Firmware Releases", HaBridge::commandTopic(settings_, "ota/check").c_str(), "check", "mdi:update", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "switch", "firmware_auto_update").c_str(), 1, true,
        HaBridge::discoveryPayloadSwitch(settings_, "firmware_auto_update", "Firmware Auto Update", HaBridge::otaStateTopic(settings_).c_str(), HaBridge::commandTopic(settings_, "ota/auto_update").c_str(), "{{ 'ON' if value_json.autoUpdate else 'OFF' }}", "mdi:auto-upload", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "firmware_install").c_str(), 1, true,
        HaBridge::discoveryPayloadButton(settings_, "firmware_install", "Install Firmware", HaBridge::commandTopic(settings_, "ota/install").c_str(), "install", "mdi:package-up", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "text", "play_url").c_str(), 1, true,
        HaBridge::discoveryPayloadText(settings_, "play_url", "Play URL", HaBridge::commandTopic(settings_, "play").c_str(), "mdi:link", HaBridge::playbackStateTopic(settings_).c_str(), "{{ value_json.url if value_json.url else '' }}", configurationUrl).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "button", "firmware_install_latest").c_str(), 1, true,
        "");
    client_.publish(
        HaBridge::discoveryTopic(settings_, "text", "firmware_install_version").c_str(), 1, true,
        "");
#ifdef APP_ENABLE_HACS_MQTT
    client_.publish(
        HaBridge::hacsMediaPlayerDiscoveryTopic(settings_).c_str(), 1, true,
        HaBridge::discoveryPayloadHacsMediaPlayer(settings_).c_str());
    client_.publish(
        HaBridge::discoveryTopic(settings_, "media_player", "hacs_player").c_str(), 1, true,
        "");
#endif
    lastOtaDiscoverySignature_ = otaDiscoverySignature;
    discoveryPublishedForSession_ = true;
}

bool MqttManager::publishButtonActionEvent(const String& buttonLabel, uint8_t pin, const String& action) {
    if (!client_.connected()) {
        return false;
    }

    JsonDocument payload;
    payload["action"] = action;
    payload["button"] = buttonLabel;
    payload["pin"] = pin;
    payload["source"] = "touch";
    publishJson(settings_.mqtt.baseTopic + "/event/button_action", payload, false);
    return true;
}

bool MqttManager::isConnected() const {
    return client_.connected();
}

bool MqttManager::shouldRebootForRecovery() const {
    return recoveryRebootRecommended_;
}

uint8_t MqttManager::consecutiveFailureCount() const {
    return consecutiveFailureCount_;
}

bool MqttManager::requestConnect(String& error) {
    if (settings_.mqtt.host.isEmpty()) {
        error = "Enter an MQTT host first.";
        return false;
    }

    error = "";
    connectionEnabled_ = true;
    if (client_.connected()) {
        if (settings_.mqtt.discoveryEnabled && !discoveryPublishedForSession_) {
            discoveryPublishPending_ = true;
        }
        statePublishPending_ = true;
        return true;
    }

    if (lastConnectAttemptAt_ != 0 && millis() - lastConnectAttemptAt_ < MQTT_RETRY_INTERVAL_MS) {
        return true;
    }

    configureClient();
    return true;
}

bool MqttManager::requestDisconnect(String& error) {
    error = "";
    connectionEnabled_ = false;
    consecutiveFailureCount_ = 0;
    recoveryRebootRecommended_ = false;
    lastConnectAttemptAt_ = millis();
    lastBrokerActivityAt_ = 0;
    client_.disconnect(true);
    if (appState_ != nullptr) {
        appState_->setMqttConnected(false);
    }
    return true;
}

bool MqttManager::requestRediscovery(String& error) {
    if (!settings_.mqtt.discoveryEnabled) {
        error = "Home Assistant discovery is disabled.";
        return false;
    }
    if (!client_.connected()) {
        error = "MQTT must be connected before discovery can be republished.";
        return false;
    }

    publishDiscovery();
    statePublishPending_ = true;
    error = "";
    return true;
}

void MqttManager::registerFailedAttempt(AsyncMqttClientDisconnectReason reason) {
    if (!connectionEnabled_ || settings_.mqtt.host.isEmpty() || client_.connected()) {
        return;
    }

    if (wifiManager_ == nullptr || !wifiManager_->isConnected()) {
        return;
    }

    if (consecutiveFailureCount_ < MQTT_MAX_CONSECUTIVE_FAILURES) {
        ++consecutiveFailureCount_;
    }

    Serial.printf("[mqtt] connect failed reason=%d count=%u/%u\n", static_cast<int>(reason),
                  static_cast<unsigned>(consecutiveFailureCount_),
                  static_cast<unsigned>(MQTT_MAX_CONSECUTIVE_FAILURES));

    if (isCredentialFailureReason(reason)) {
        setFrontendError("MQTT broker rejected the configured client ID or credentials.");
        recoveryRebootRecommended_ = false;
        return;
    }

    if (consecutiveFailureCount_ >= MQTT_MAX_CONSECUTIVE_FAILURES) {
        setFrontendError("MQTT broker unreachable. The device will keep retrying without rebooting.");
        recoveryRebootRecommended_ = false;
        Serial.println("[mqtt] max consecutive failures reached, continuing retries without recovery reboot");
    }
}

bool MqttManager::isCredentialFailureReason(AsyncMqttClientDisconnectReason reason) const {
    switch (reason) {
        case AsyncMqttClientDisconnectReason::MQTT_UNACCEPTABLE_PROTOCOL_VERSION:
        case AsyncMqttClientDisconnectReason::MQTT_IDENTIFIER_REJECTED:
        case AsyncMqttClientDisconnectReason::MQTT_MALFORMED_CREDENTIALS:
        case AsyncMqttClientDisconnectReason::MQTT_NOT_AUTHORIZED:
            return true;
        default:
            return false;
    }
}

void MqttManager::noteBrokerActivity() {
    lastBrokerActivityAt_ = millis();
}

void MqttManager::clearFrontendError() {
    if (appState_ != nullptr) {
        appState_->setLastError("");
    }
}

void MqttManager::setFrontendError(const String& message) {
    if (appState_ != nullptr) {
        appState_->setLastError(message);
    }
}
