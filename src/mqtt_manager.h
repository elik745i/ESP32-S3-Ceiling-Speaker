#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <AsyncMqttClient.h>
#include <functional>

#include "app_state.h"
#include "ha_bridge.h"
#include "ota_manager.h"
#include "settings_schema.h"
#include "wifi_manager.h"

class MqttManager {
  public:
    using CommandHandler = std::function<void(const PlaybackCommand& command)>;

    void begin(const SettingsBundle& settings, AppState& appState, WiFiManager& wifiManager, OtaManager& otaManager, CommandHandler commandHandler);
    void applySettings(const SettingsBundle& settings);
    void loop();
    void publishState();
    void publishBattery(float voltage, float rawAdcVoltage, uint16_t rawAdc);
    void publishDiscovery();
    bool publishButtonActionEvent(const String& buttonLabel, uint8_t pin, const String& action);
    bool isConnected() const;
    bool requestConnect(String& error);
    bool requestDisconnect(String& error);
    bool shouldRebootForRecovery() const;
    uint8_t consecutiveFailureCount() const;

  private:
    static constexpr uint8_t MQTT_MAX_CONSECUTIVE_FAILURES = 10;
    static constexpr uint16_t MQTT_KEEP_ALIVE_SECONDS = 15;
    static constexpr uint32_t MQTT_RETRY_INTERVAL_MS = 5000UL;
    static constexpr uint32_t MQTT_STALE_CONNECTION_MS = 90000UL;

    AsyncMqttClient client_;
    SettingsBundle settings_;
    AppState* appState_ = nullptr;
    WiFiManager* wifiManager_ = nullptr;
    OtaManager* otaManager_ = nullptr;
    CommandHandler commandHandler_;
    bool configured_ = false;
    bool connectionEnabled_ = true;
    bool recoveryRebootRecommended_ = false;
    bool discoveryPublishPending_ = false;
    bool statePublishPending_ = false;
    bool discoveryPublishedForSession_ = false;
    bool wifiWasConnected_ = false;
    String lastOtaDiscoverySignature_;
    uint8_t consecutiveFailureCount_ = 0;
    unsigned long lastConnectAttemptAt_ = 0;
    unsigned long lastStatePublishAt_ = 0;
    unsigned long lastBrokerActivityAt_ = 0;

    void configureClient();
    void connectIfNeeded();
    void handleWiFiState();
    void handleConnected(bool sessionPresent);
    void handleDisconnected(AsyncMqttClientDisconnectReason reason);
    void handleMessage(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total);
    void publishJson(const String& topic, const JsonDocument& doc, bool retained);
    String currentConfigUrl() const;
    void noteBrokerActivity();
    bool isCredentialFailureReason(AsyncMqttClientDisconnectReason reason) const;
    void clearFrontendError();
    void setFrontendError(const String& message);
    void registerFailedAttempt(AsyncMqttClientDisconnectReason reason);
};
