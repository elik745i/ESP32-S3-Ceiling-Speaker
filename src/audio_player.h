#pragma once

#include <Arduino.h>

#include "app_state.h"

class AudioPlayer {
  public:
    class Impl;

    void begin(uint8_t bclkPin, uint8_t wsPin, uint8_t doutPin, uint8_t initialVolumePercent, AppState& appState);
    void loop();
    bool play(const String& url, const String& title, const String& mediaType, const String& source);
    void stop();
    bool reconfigureOutputPins(uint8_t bclkPin, uint8_t wsPin, uint8_t doutPin);
    void setVolumePercent(uint8_t volumePercent);
    uint8_t volumePercent() const;
    String currentTitle() const;
    String currentUrl() const;
    String currentState() const;

    void onStationName(const char* text);
    void onStreamTitle(const char* text);
    void onInfo(const char* text);
    void onEof(const char* text);

  private:
    Impl* impl_ = nullptr;
};
