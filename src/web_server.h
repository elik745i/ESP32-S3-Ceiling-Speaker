#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>

#ifndef APP_DISABLE_WEB_UI
#include <ESPAsyncWebServer.h>
#include <FS.h>
#endif

#include "app_state.h"
#include "ota_manager.h"
#include "settings_manager.h"
#include "storage_backend.h"
#include "wifi_manager.h"

class WebServerManager {
  public:
    using SettingsGetter = std::function<SettingsBundle(void)>;
    using SettingsSaver = std::function<bool(JsonVariantConst, String&)>;
    using PlayHandler = std::function<bool(const String&, const String&, const String&, String&)>;
    using StopHandler = std::function<void(void)>;
    using VolumeHandler = std::function<void(uint8_t)>;
    using SimpleHandler = std::function<void(void)>;
    using OtaHandler = std::function<bool(bool)>;
    using MqttHandler = std::function<bool(const String&, String&)>;

    WebServerManager();
    void begin(
        AppState& appState,
        WiFiManager& wifiManager,
        SettingsManager& settingsManager,
        OtaManager& otaManager,
        SettingsGetter settingsGetter,
        SettingsSaver settingsSaver,
        PlayHandler playHandler,
        StopHandler stopHandler,
        VolumeHandler volumeHandler,
        OtaHandler otaHandler,
        MqttHandler mqttHandler,
        SimpleHandler displayTriggerHandler,
        SimpleHandler serverShutdownHandler,
        SimpleHandler rebootHandler,
        SimpleHandler factoryResetHandler);
    void setWebUiLocked(bool locked);
    bool webUiLocked() const;

  private:
#ifndef APP_DISABLE_WEB_UI
    AsyncWebServer server_;
    AppState* appState_ = nullptr;
    WiFiManager* wifiManager_ = nullptr;
    SettingsManager* settingsManager_ = nullptr;
    OtaManager* otaManager_ = nullptr;
    SettingsGetter settingsGetter_;
    SettingsSaver settingsSaver_;
    PlayHandler playHandler_;
    StopHandler stopHandler_;
    VolumeHandler volumeHandler_;
    OtaHandler otaHandler_;
    MqttHandler mqttHandler_;
    SimpleHandler displayTriggerHandler_;
    SimpleHandler serverShutdownHandler_;
    SimpleHandler rebootHandler_;
    SimpleHandler factoryResetHandler_;
    bool webUiLocked_ = false;
    File storageUploadFile_;
    StorageTarget storageUploadTarget_ = StorageTarget::Flash;
    String storageUploadPath_;
    String storageUploadError_;
    size_t storageUploadBytesWritten_ = 0;
    size_t storageUploadLimitBytes_ = 0;
    uint8_t* storageTransferBuffer_ = nullptr;
    size_t storageTransferBufferCapacity_ = 0;

    bool ensureAuthorized(AsyncWebServerRequest* request);
    bool rejectIfWebUiLocked(AsyncWebServerRequest* request);
    bool ensureStorageTransferBuffer(size_t minimumSize);
    bool redirectCaptivePortalIfNeeded(AsyncWebServerRequest* request);
    void sendJson(AsyncWebServerRequest* request, const JsonDocument& doc, int statusCode = 200);
    void registerApiRoutes();
    void registerWebRoutes();
  #endif
};
