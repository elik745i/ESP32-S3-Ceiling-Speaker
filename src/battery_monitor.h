#pragma once

#include <Arduino.h>

#include <stdint.h>

#include "app_state.h"
#include "settings_schema.h"

struct BatteryReading {
    float filteredVoltage = 0.0f;
    float rawAdcVoltage = 0.0f;
    uint16_t rawAdc = 0;
  bool charging = false;
};

class BatteryMonitor {
  public:
    void begin(const BatterySettings& settings, uint8_t adcPin, AppState& appState);
    void applySettings(const BatterySettings& settings, uint8_t adcPin);
    bool loop(bool samplingAllowed = true);
    BatteryReading latest() const;
    bool enabled() const;

  private:
    static constexpr uint16_t kMaxWindowSize = 32;

    BatterySettings settings_;
    AppState* appState_ = nullptr;
    uint8_t adcPin_ = 0;
    unsigned long lastSampleAt_ = 0;
    BatteryReading latest_;
    float movingAverageSamples_[kMaxWindowSize] = {};
    float movingAverageSum_ = 0.0f;
    uint16_t movingAverageCount_ = 0;
    uint16_t movingAverageIndex_ = 0;
    float lastTrendVoltage_ = 0.0f;
    uint8_t chargingSensePin_ = 0;
    bool chargingState_ = false;
    bool chargingStateInitialized_ = false;

    void resetFilterState();
    BatteryReading sampleNow();
};
