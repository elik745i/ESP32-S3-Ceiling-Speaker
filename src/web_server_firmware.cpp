#include "web_server.h"

#ifndef APP_DISABLE_WEB_UI

// Release discovery is kept separate from the large route table because it
// owns asynchronous refresh semantics and must never perform network work in
// the HTTP callback itself.
void WebServerManager::registerFirmwareRoutes() {
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
}

#endif
