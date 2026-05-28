#include "web_server.h"

#ifdef APP_DISABLE_WEB_UI

WebServerManager::WebServerManager() = default;

void WebServerManager::begin(
    AppState&,
    WiFiManager&,
    SettingsManager&,
    OtaManager&,
    SettingsGetter,
    SettingsSaver,
    PlayHandler,
    StopHandler,
    VolumeHandler,
    OtaHandler,
    MqttHandler,
    SimpleHandler,
    SimpleHandler,
    SimpleHandler) {
}

#else

#include <ArduinoJson.h>

#include "generated_web_assets.h"
#include "version.h"

namespace {
const EmbeddedWebAsset* findAsset(const String& path) {
    for (size_t index = 0; index < WEB_ASSET_COUNT; ++index) {
        if (path == WEB_ASSETS[index].path) {
            return &WEB_ASSETS[index];
        }
    }
    return nullptr;
}
}  // namespace

WebServerManager::WebServerManager() : server_(80) {}

void WebServerManager::begin(
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
    SimpleHandler rebootHandler,
    SimpleHandler factoryResetHandler) {
    appState_ = &appState;
    wifiManager_ = &wifiManager;
    settingsManager_ = &settingsManager;
    otaManager_ = &otaManager;
    settingsGetter_ = settingsGetter;
    settingsSaver_ = settingsSaver;
    playHandler_ = playHandler;
    stopHandler_ = stopHandler;
    volumeHandler_ = volumeHandler;
    otaHandler_ = otaHandler;
    mqttHandler_ = mqttHandler;
    displayTriggerHandler_ = displayTriggerHandler;
    rebootHandler_ = rebootHandler;
    factoryResetHandler_ = factoryResetHandler;

    registerApiRoutes();
    registerWebRoutes();
    server_.begin();
}

bool WebServerManager::ensureAuthorized(AsyncWebServerRequest* request) {
    const SettingsBundle settings = settingsGetter_();
    if (!settings.webAuth.enabled) {
        return true;
    }
    if (request->authenticate(settings.webAuth.username.c_str(), settings.webAuth.password.c_str())) {
        return true;
    }
    request->requestAuthentication();
    return false;
}

bool WebServerManager::redirectCaptivePortalIfNeeded(AsyncWebServerRequest* request) {
    if (wifiManager_ != nullptr && wifiManager_->shouldRedirectCaptivePortal(request->host())) {
        request->redirect("http://192.168.4.1/");
        return true;
    }
    return false;
}

void WebServerManager::sendJson(AsyncWebServerRequest* request, const JsonDocument& doc, int statusCode) {
    AsyncResponseStream* response = request->beginResponseStream("application/json");
    response->setCode(statusCode);
    serializeJson(doc, *response);
    request->send(response);
}

void WebServerManager::registerApiRoutes() {
    server_.on("/api/status", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        JsonDocument doc;
        appState_->toJson(doc.to<JsonObject>());
        JsonObject firmware = doc["firmware"].to<JsonObject>();
        firmware["version"] = APP_VERSION;
        firmware["buildDate"] = APP_BUILD_DATE;
    #if defined(CONFIG_IDF_TARGET_ESP32S3)
        firmware["chipFamily"] = "esp32s3";
    #elif defined(CONFIG_IDF_TARGET_ESP32)
        firmware["chipFamily"] = "esp32";
    #else
        firmware["chipFamily"] = ESP.getChipModel();
    #endif
    #ifdef APP_DISABLE_AUDIO
        firmware["audioEnabled"] = false;
    #else
        firmware["audioEnabled"] = true;
    #endif
        firmware["buttonEventTopic"] = settingsGetter_().mqtt.baseTopic + "/event/button_action";
        otaManager_->appendStatusJson(doc["otaManager"].to<JsonObject>());
        sendJson(request, doc);
    });

    server_.on("/api/settings", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        JsonDocument doc;
        settingsManager_->toJson(settingsGetter_(), doc.to<JsonObject>());
        sendJson(request, doc);
    });

    server_.on("/api/wifi/scan", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        JsonDocument doc;
        const bool start = request->hasParam("start") && request->getParam("start")->value() == "1";
        if (start) {
            doc["started"] = wifiManager_->startScan();
        }
        const WiFiManager::ScanSnapshot snapshot = wifiManager_->getScanSnapshot();
        doc["scanning"] = snapshot.active;
        doc["complete"] = snapshot.complete;
        doc["failed"] = snapshot.failed;
        doc["scanAgeMs"] = snapshot.ageMs;
        if (snapshot.complete) {
            wifiManager_->appendScanResultsJson(doc["networks"].to<JsonArray>());
        }
        sendJson(request, doc);
    });

    server_.on(
        "/api/settings", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            (void)request;
        }, nullptr,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (index != 0 || len != total) {
                return;
            }
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            JsonDocument doc;
            const DeserializationError error = deserializeJson(doc, data, len);
            if (error != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }
            String message;
            if (!settingsSaver_(doc.as<JsonVariantConst>(), message)) {
                request->send(400, "application/json", String("{\"error\":\"") + message + "\"}");
                return;
            }
            JsonDocument response;
            response["ok"] = true;
            sendJson(request, response);
        });

    server_.on(
        "/api/play", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            (void)request;
        }, nullptr,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (index != 0 || len != total) {
                return;
            }
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }
            const String url = String(static_cast<const char*>(doc["url"] | ""));
            const String label = String(static_cast<const char*>(doc["label"] | ""));
            const String type = String(static_cast<const char*>(doc["type"] | "stream"));
            String message;
            if (!playHandler_(url, label, type, message)) {
                request->send(400, "application/json", String("{\"error\":\"") + message + "\"}");
                return;
            }
            request->send(200, "application/json", "{\"ok\":true}");
        });

    server_.on(
        "/api/volume", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            (void)request;
        }, nullptr,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (index != 0 || len != total) {
                return;
            }
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }
            const uint8_t volume = doc["volumePercent"] | doc["volume"] | 0;
            volumeHandler_(volume);
            request->send(200, "application/json", "{\"ok\":true}");
        });

    server_.on("/api/stop", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        stopHandler_();
        request->send(200, "application/json", "{\"ok\":true}");
    });

    server_.on("/api/display-trigger", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        if (displayTriggerHandler_) {
            displayTriggerHandler_();
        }
        request->send(200, "application/json", "{\"ok\":true}");
    });

    server_.on(
        "/api/ota/check", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            (void)request;
        }, nullptr,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (index != 0 || len != total) {
                return;
            }
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            JsonDocument doc;
            bool apply = false;
            if (len > 0 && deserializeJson(doc, data, len) == DeserializationError::Ok) {
                apply = doc["apply"] | false;
            }
            if (!otaHandler_(apply)) {
                request->send(409, "application/json", "{\"error\":\"ota busy\"}");
                return;
            }
            JsonDocument response;
            response["ok"] = true;
            otaManager_->appendStatusJson(response["ota"].to<JsonObject>());
            sendJson(request, response);
        });

    server_.on(
        "/api/mqtt", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            (void)request;
        }, nullptr,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (index != 0 || len != total) {
                return;
            }
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }

            JsonDocument doc;
            if (len == 0 || deserializeJson(doc, data, len) != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }

            const String action = String(static_cast<const char*>(doc["action"] | ""));
            const bool connect = action != "disconnect";
            String error;
            if (!mqttHandler_ || !mqttHandler_(connect, error)) {
                request->send(400, "application/json", String("{\"error\":\"") + error + "\"}");
                return;
            }

            JsonDocument response;
            response["ok"] = true;
            response["action"] = connect ? "connect" : "disconnect";
            response["message"] = connect ? "MQTT connect requested" : "MQTT disconnect requested";
            sendJson(request, response);
        });

    server_.on("/api/firmware", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        JsonDocument response;
        String error;
        const bool refresh = request->hasParam("refresh") && request->getParam("refresh")->value() == "1";
        otaManager_->appendFirmwareInfoJson(response.to<JsonObject>(), refresh, error);
        sendJson(request, response);
    });

    server_.on(
        "/api/firmware/update", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            (void)request;
        }, nullptr,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            if (index != 0 || len != total) {
                return;
            }
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }
            const String version = String(static_cast<const char*>(doc["version"] | ""));
            const String assetName = String(static_cast<const char*>(doc["assetName"] | ""));
            String error;
            if (!otaManager_->triggerInstallVersion(version, assetName, error)) {
                request->send(409, "application/json", String("{\"error\":\"") + error + "\"}");
                return;
            }

            JsonDocument response;
            response["ok"] = true;
            response["message"] = String("Update queued for ") + (assetName.isEmpty() ? version : assetName);
            sendJson(request, response);
        });

    server_.on(
        "/api/firmware/upload", HTTP_POST,
        [this](AsyncWebServerRequest* request) {
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            JsonDocument response;
            JsonObject ota = response["ota"].to<JsonObject>();
            otaManager_->appendStatusJson(ota);
            const String selectedVersion = String(static_cast<const char*>(ota["selectedVersion"] | ""));
            const String message = String(static_cast<const char*>(ota["message"] | ""));
            if (selectedVersion == "local" && message.startsWith("Local firmware uploaded")) {
                response["ok"] = true;
                response["message"] = message;
                sendJson(request, response, 200);
                return;
            }
            response["error"] = message.isEmpty() ? "Firmware upload did not complete." : message;
            sendJson(request, response, 400);
        },
        [this](AsyncWebServerRequest* request, const String& filename, size_t index, uint8_t* data, size_t len, bool final) {
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }
            String error;
            if (index == 0) {
                if (!otaManager_->beginLocalUpload(filename, request->contentLength(), error)) {
                    return;
                }
            }
            if (len > 0 && !otaManager_->writeLocalUploadChunk(data, len, error)) {
                return;
            }
            if (final && !otaManager_->finishLocalUpload(error)) {
                return;
            }
        });

    server_.on("/api/reboot", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        rebootHandler_();
        request->send(200, "application/json", "{\"ok\":true}");
    });

    server_.on("/api/factory-reset", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        factoryResetHandler_();
        request->send(200, "application/json", "{\"ok\":true}");
    });
}

void WebServerManager::registerWebRoutes() {
    auto serveAsset = [this](AsyncWebServerRequest* request, const String& path) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        const EmbeddedWebAsset* asset = findAsset(path);
        if (asset == nullptr) {
            request->send(404, "text/plain", "Not found");
            return;
        }
        AsyncWebServerResponse* response = request->beginResponse(200, asset->contentType, asset->data, asset->size);
        if (asset->gzip) {
            response->addHeader("Content-Encoding", "gzip");
            response->addHeader("Vary", "Accept-Encoding");
        }
        response->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        response->addHeader("Pragma", "no-cache");
        response->addHeader("Expires", "0");
        request->send(response);
    };

    server_.on("/", HTTP_GET, [serveAsset](AsyncWebServerRequest* request) { serveAsset(request, "/index.html"); });
    server_.on("/index.html", HTTP_GET, [serveAsset](AsyncWebServerRequest* request) { serveAsset(request, "/index.html"); });
    server_.on("/style.css", HTTP_GET, [serveAsset](AsyncWebServerRequest* request) { serveAsset(request, "/style.css"); });
    server_.on("/app.js", HTTP_GET, [serveAsset](AsyncWebServerRequest* request) { serveAsset(request, "/app.js"); });
    server_.on("/generate_204", HTTP_GET, [this](AsyncWebServerRequest* request) { request->redirect("/"); });
    server_.on("/hotspot-detect.html", HTTP_GET, [this](AsyncWebServerRequest* request) { request->redirect("/"); });
    server_.on("/connecttest.txt", HTTP_GET, [this](AsyncWebServerRequest* request) { request->redirect("/"); });
    server_.on("/ncsi.txt", HTTP_GET, [this](AsyncWebServerRequest* request) { request->redirect("/"); });

    server_.onNotFound([this, serveAsset](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request)) {
            return;
        }
        const EmbeddedWebAsset* asset = findAsset(request->url());
        if (asset != nullptr) {
            serveAsset(request, request->url());
            return;
        }
        request->send(404, "text/plain", "Not found");
    });
}

#endif
