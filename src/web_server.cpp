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
#include <esp_heap_caps.h>

#include "generated_web_assets.h"
#include "storage_backend.h"
#include "system_metrics.h"
#include "version.h"

namespace {
constexpr size_t kStorageReserveBytes = 4096;

const EmbeddedWebAsset* findAsset(const String& path) {
    for (size_t index = 0; index < WEB_ASSET_COUNT; ++index) {
        if (path == WEB_ASSETS[index].path) {
            return &WEB_ASSETS[index];
        }
    }
    return nullptr;
}

StorageTarget storageTargetFromRequest(AsyncWebServerRequest* request) {
    if (request->hasParam("target")) {
        return parseStorageTarget(request->getParam("target")->value());
    }
    return StorageTarget::Flash;
}

String normalizeStoragePath(const String& rawPath, bool allowRoot = false) {
    String path = rawPath;
    path.replace('\\', '/');
    path.trim();
    if (path.isEmpty()) {
        return allowRoot ? String("/") : String();
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    while (path.indexOf("//") >= 0) {
        path.replace("//", "/");
    }
    if (path.indexOf("..") >= 0) {
        return String();
    }
    while (path.length() > 1 && path.endsWith("/")) {
        path.remove(path.length() - 1);
    }
    if (!allowRoot && path == "/") {
        return String();
    }
    return path;
}

String storagePathFromRequest(const String& rawPath) {
    return normalizeStoragePath(rawPath, false);
}

String storageDirectoryFromRequest(AsyncWebServerRequest* request) {
    if (!request->hasParam("dir")) {
        return String("/");
    }
    return normalizeStoragePath(request->getParam("dir")->value(), true);
}

String sanitizeUploadFilename(const String& filename) {
    String clean = filename;
    clean.replace('\\', '/');
    const int slashIndex = clean.lastIndexOf('/');
    if (slashIndex >= 0) {
        clean = clean.substring(slashIndex + 1);
    }
    clean.trim();
    if (clean.isEmpty()) {
        return String();
    }

    String sanitized;
    sanitized.reserve(clean.length());
    for (size_t index = 0; index < clean.length(); ++index) {
        const char ch = clean.charAt(index);
        const bool allowed = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') ||
            ch == '.' || ch == '-' || ch == '_' || ch == ' ';
        sanitized += allowed ? ch : '_';
    }

    sanitized.trim();
    return sanitized;
}

String storageBaseName(const String& path) {
    if (path.isEmpty() || path == "/") {
        return String("/");
    }
    const int slashIndex = path.lastIndexOf('/');
    return slashIndex >= 0 ? path.substring(slashIndex + 1) : path;
}

String storageParentPath(const String& path) {
    const String normalized = normalizeStoragePath(path, true);
    if (normalized.isEmpty() || normalized == "/") {
        return String();
    }
    const int slashIndex = normalized.lastIndexOf('/');
    if (slashIndex <= 0) {
        return String("/");
    }
    return normalized.substring(0, slashIndex);
}

String joinStoragePath(const String& directoryPath, const String& name) {
    String dir = normalizeStoragePath(directoryPath, true);
    String leaf = name;
    leaf.replace('\\', '/');
    while (leaf.startsWith("/")) {
        leaf.remove(0, 1);
    }
    while (leaf.endsWith("/")) {
        leaf.remove(leaf.length() - 1);
    }
    leaf.trim();
    if (dir.isEmpty() || leaf.isEmpty()) {
        return String();
    }
    return dir == "/" ? String("/") + leaf : dir + "/" + leaf;
}

String storageDownloadName(const String& path) {
    if (!path.startsWith("/")) {
        return path;
    }
    return path.substring(1);
}

bool isAllowedStoragePath(const String& path) {
    const String lower = path;
    return lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".aac") || lower.endsWith(".m4a") ||
        lower.endsWith(".ogg") || lower.endsWith(".opus") || lower.endsWith(".flac");
}

const char* contentTypeForPath(const String& path) {
    const String lower = path;
    if (lower.endsWith(".mp3")) return "audio/mpeg";
    if (lower.endsWith(".wav")) return "audio/wav";
    if (lower.endsWith(".aac")) return "audio/aac";
    if (lower.endsWith(".m4a")) return "audio/mp4";
    if (lower.endsWith(".ogg")) return "audio/ogg";
    if (lower.endsWith(".opus")) return "audio/ogg";
    if (lower.endsWith(".flac")) return "audio/flac";
    return "application/octet-stream";
}

String storageUnavailableMessage(StorageTarget target) {
    return String(storageTargetLabel(target)) + " is not mounted.";
}

void appendStorageSummaryJson(StorageTarget target, JsonObject root) {
    const StorageBackendSummary summary = getStorageSummary(target);
    root["target"] = storageTargetId(target);
    root["label"] = storageTargetLabel(target);
    root["available"] = summary.available;
    root["mounted"] = summary.mounted;
    root["totalBytes"] = summary.totalBytes;
    root["usedBytes"] = summary.usedBytes;
    root["freeBytes"] = summary.freeBytes;
    root["maxUploadBytes"] = static_cast<uint32_t>(summary.freeBytes > kStorageReserveBytes ? summary.freeBytes - kStorageReserveBytes : 0);
}

void appendStorageEntriesJson(StorageTarget target, const String& directoryPath, JsonArray files) {
    if (!storageMounted(target)) {
        return;
    }

    File root = storageOpen(target, directoryPath, "r");
    if (!root || !root.isDirectory()) {
        return;
    }

    for (File entry = root.openNextFile(); entry; entry = root.openNextFile()) {
        JsonObject file = files.add<JsonObject>();
        const String path = String(entry.path());
        const bool isDirectory = entry.isDirectory();
        file["path"] = path;
        file["name"] = storageBaseName(path);
        file["isDirectory"] = isDirectory;
        file["sizeBytes"] = isDirectory ? 0U : static_cast<uint32_t>(entry.size());
        if (!isDirectory) {
            file["url"] = String("/api/storage/file?target=") + storageTargetId(target) + "&path=" + path;
        }
    }
}

bool removeStoragePathRecursive(StorageTarget target, const String& path) {
    fs::FS* fs = getStorageFs(target);
    if (fs == nullptr) {
        return false;
    }

    File entry = fs->open(path, "r");
    if (!entry) {
        return false;
    }
    if (!entry.isDirectory()) {
        entry.close();
        return fs->remove(path);
    }

    while (File child = entry.openNextFile()) {
        const String childPath = String(child.path());
        child.close();
        if (!removeStoragePathRecursive(target, childPath)) {
            entry.close();
            return false;
        }
    }
    entry.close();
    return path != "/" && fs->rmdir(path);
}

bool createStorageDirectory(StorageTarget target, const String& path) {
    fs::FS* fs = getStorageFs(target);
    return fs != nullptr && path != "/" && fs->mkdir(path);
}

void appendStorageDirectoryJson(StorageTarget target, const String& directoryPath, JsonDocument& response) {
    const String currentPath = normalizeStoragePath(directoryPath, true);
    response["target"] = storageTargetId(target);
    response["label"] = storageTargetLabel(target);
    response["currentPath"] = currentPath;
    response["parentPath"] = storageParentPath(currentPath);
    JsonObject storage = response["storage"].to<JsonObject>();
    appendStorageSummaryJson(target, storage);
    appendStorageEntriesJson(target, currentPath, response["entries"].to<JsonArray>());
}
}  // namespace

WebServerManager::WebServerManager() : server_(80) {}

bool WebServerManager::ensureStorageTransferBuffer(size_t minimumSize) {
    if (minimumSize == 0) {
        return true;
    }
    if (storageTransferBuffer_ != nullptr && storageTransferBufferCapacity_ >= minimumSize) {
        return true;
    }

    if (storageTransferBuffer_ != nullptr) {
        heap_caps_free(storageTransferBuffer_);
        storageTransferBuffer_ = nullptr;
        storageTransferBufferCapacity_ = 0;
    }

    void* memory = nullptr;
    if (psramFound()) {
        memory = heap_caps_malloc(minimumSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    }
    if (memory == nullptr) {
        memory = heap_caps_malloc(minimumSize, MALLOC_CAP_8BIT);
    }
    if (memory == nullptr) {
        return false;
    }

    storageTransferBuffer_ = static_cast<uint8_t*>(memory);
    storageTransferBufferCapacity_ = minimumSize;
    return true;
}

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
        JsonObject root = doc.to<JsonObject>();
        appState_->toJson(root);
        appendSystemMetricsJson(root);
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

    server_.on("/api/storage", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }

        const StorageTarget target = storageTargetFromRequest(request);
        JsonDocument response;
        appendStorageDirectoryJson(target, storageDirectoryFromRequest(request), response);
        sendJson(request, response);
    });

    server_.on("/api/storage/file", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
            return;
        }
        const StorageTarget target = storageTargetFromRequest(request);
        if (!storageMounted(target)) {
            request->send(503, "application/json", String("{\"error\":\"") + storageUnavailableMessage(target) + "\"}");
            return;
        }
        if (!request->hasParam("path")) {
            request->send(400, "application/json", "{\"error\":\"Missing path.\"}");
            return;
        }

        const String path = storagePathFromRequest(request->getParam("path")->value());
        if (path.isEmpty() || !storageExists(target, path)) {
            request->send(404, "application/json", "{\"error\":\"File not found.\"}");
            return;
        }

        const bool download = request->hasParam("download") && request->getParam("download")->value() == "1";
        File file = storageOpen(target, path, "r");
        if (!file || file.isDirectory()) {
            request->send(404, "application/json", "{\"error\":\"File not found.\"}");
            return;
        }
        if (!ensureStorageTransferBuffer(4096)) {
            file.close();
            request->send(500, "application/json", "{\"error\":\"Unable to allocate transfer buffer.\"}");
            return;
        }

        AsyncWebServerResponse* response = request->beginChunkedResponse(
            contentTypeForPath(path),
            [this, file = std::move(file)](uint8_t* buffer, size_t maxLen, size_t) mutable -> size_t {
                if (!file || maxLen == 0) {
                    if (file) {
                        file.close();
                    }
                    return 0;
                }

                const size_t chunkSize = min(maxLen, storageTransferBufferCapacity_);
                const size_t bytesRead = file.read(storageTransferBuffer_, chunkSize);
                if (bytesRead > 0) {
                    memcpy(buffer, storageTransferBuffer_, bytesRead);
                    return bytesRead;
                }

                file.close();
                return 0;
            });
        if (download) {
            response->addHeader("Content-Disposition", String("attachment; filename=\"") + storageDownloadName(path) + "\"");
        }
        response->addHeader("Cache-Control", "no-store");
        request->send(response);
    });

    server_.on(
        "/api/storage/delete", HTTP_POST,
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
            const StorageTarget target = storageTargetFromRequest(request);
            const String directoryPath = storageDirectoryFromRequest(request);
            if (!storageMounted(target)) {
                request->send(503, "application/json", String("{\"error\":\"") + storageUnavailableMessage(target) + "\"}");
                return;
            }

            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }

            const String path = storagePathFromRequest(String(static_cast<const char*>(doc["path"] | "")));
            if (path.isEmpty() || !storageExists(target, path)) {
                request->send(404, "application/json", "{\"error\":\"File not found.\"}");
                return;
            }
            if (!removeStoragePathRecursive(target, path)) {
                request->send(500, "application/json", "{\"error\":\"Unable to delete path.\"}");
                return;
            }

            JsonDocument response;
            response["ok"] = true;
            response["message"] = String("Deleted ") + path;
            appendStorageDirectoryJson(target, directoryPath, response);
            sendJson(request, response);
        });

    server_.on(
        "/api/storage/mkdir", HTTP_POST,
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

            const StorageTarget target = storageTargetFromRequest(request);
            const String directoryPath = storageDirectoryFromRequest(request);
            if (!storageMounted(target)) {
                request->send(503, "application/json", String("{\"error\":\"") + storageUnavailableMessage(target) + "\"}");
                return;
            }

            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                request->send(400, "application/json", "{\"error\":\"invalid json\"}");
                return;
            }

            const String name = sanitizeUploadFilename(String(static_cast<const char*>(doc["name"] | "")));
            const String path = joinStoragePath(directoryPath, name);
            if (path.isEmpty()) {
                request->send(400, "application/json", "{\"error\":\"Folder name is required.\"}");
                return;
            }
            if (storageExists(target, path)) {
                request->send(409, "application/json", "{\"error\":\"A file or folder with that name already exists.\"}");
                return;
            }
            if (!createStorageDirectory(target, path)) {
                request->send(500, "application/json", "{\"error\":\"Unable to create folder.\"}");
                return;
            }

            JsonDocument response;
            response["ok"] = true;
            response["message"] = String("Created folder ") + path;
            appendStorageDirectoryJson(target, directoryPath, response);
            sendJson(request, response);
        });

    server_.on(
        "/api/storage/upload", HTTP_POST,
        [this](AsyncWebServerRequest* request) {
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }

            JsonDocument response;
            if (!storageUploadError_.isEmpty()) {
                response["error"] = storageUploadError_;
                if (storageUploadFile_) {
                    storageUploadFile_.close();
                }
                if (!storageUploadPath_.isEmpty()) {
                    storageRemove(storageUploadTarget_, storageUploadPath_);
                }
                storageUploadPath_ = "";
                storageUploadBytesWritten_ = 0;
                storageUploadLimitBytes_ = 0;
                storageUploadError_ = "";
                sendJson(request, response, 400);
                return;
            }

            response["ok"] = true;
            response["message"] = String("Uploaded ") + storageUploadPath_;
            response["path"] = storageUploadPath_;
            appendStorageDirectoryJson(storageUploadTarget_, storageParentPath(storageUploadPath_), response);
            storageUploadPath_ = "";
            storageUploadBytesWritten_ = 0;
            storageUploadLimitBytes_ = 0;
            storageUploadError_ = "";
            sendJson(request, response);
        },
        [this](AsyncWebServerRequest* request, const String& filename, size_t index, uint8_t* data, size_t len, bool final) {
            if (redirectCaptivePortalIfNeeded(request) || !ensureAuthorized(request)) {
                return;
            }

            if (index == 0) {
                storageUploadTarget_ = storageTargetFromRequest(request);
                const String directoryPath = storageDirectoryFromRequest(request);
                storageUploadError_ = "";
                storageUploadPath_ = joinStoragePath(directoryPath, sanitizeUploadFilename(filename));
                storageUploadBytesWritten_ = 0;
                storageUploadLimitBytes_ = 0;

                if (!storageMounted(storageUploadTarget_)) {
                    storageUploadError_ = storageUnavailableMessage(storageUploadTarget_);
                    return;
                }
                if (storageUploadPath_.isEmpty() || !isAllowedStoragePath(storageUploadPath_)) {
                    storageUploadError_ = "Only audio files (.mp3, .wav, .aac, .m4a, .ogg, .opus, .flac) are allowed.";
                    return;
                }

                const size_t existingSize = storageExists(storageUploadTarget_, storageUploadPath_)
                    ? static_cast<size_t>(storageOpen(storageUploadTarget_, storageUploadPath_, "r").size())
                    : 0;
                const StorageBackendSummary summary = getStorageSummary(storageUploadTarget_);
                const size_t freeBytes = summary.freeBytes;
                const size_t availableBytes = freeBytes + existingSize;
                storageUploadLimitBytes_ = availableBytes > kStorageReserveBytes ? availableBytes - kStorageReserveBytes : 0;
                if (storageUploadLimitBytes_ == 0) {
                    storageUploadError_ = "Not enough free space for upload.";
                    return;
                }

                storageUploadFile_ = storageOpen(storageUploadTarget_, storageUploadPath_, "w");
                if (!storageUploadFile_) {
                    storageUploadError_ = "Unable to open destination file.";
                    return;
                }
            }

            if (!storageUploadError_.isEmpty()) {
                return;
            }
            if (len > 0) {
                if ((storageUploadBytesWritten_ + len) > storageUploadLimitBytes_) {
                    storageUploadError_ = "File is larger than remaining filesystem space.";
                    storageUploadFile_.close();
                    storageRemove(storageUploadTarget_, storageUploadPath_);
                    return;
                }
                if (!ensureStorageTransferBuffer(len)) {
                    storageUploadError_ = psramFound() ? "Unable to allocate PSRAM-backed transfer buffer." : "Unable to allocate transfer buffer.";
                    storageUploadFile_.close();
                    storageRemove(storageUploadTarget_, storageUploadPath_);
                    return;
                }
                memcpy(storageTransferBuffer_, data, len);
                const size_t written = storageUploadFile_.write(storageTransferBuffer_, len);
                if (written != len) {
                    storageUploadError_ = "Failed while writing uploaded file.";
                    storageUploadFile_.close();
                    storageRemove(storageUploadTarget_, storageUploadPath_);
                    return;
                }
                storageUploadBytesWritten_ += written;
            }
            if (final && storageUploadFile_) {
                storageUploadFile_.close();
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
