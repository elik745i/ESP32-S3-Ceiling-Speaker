#pragma once

#include <math.h>
#include <stdint.h>

namespace WifiPowerPolicy {
constexpr float kDefaultDbm = 15.0f;
constexpr float kMinDbm = 2.0f;
constexpr float kMaxDbm = 19.5f;

inline float normalize(float value) {
    if (!isfinite(value)) return kDefaultDbm;
    if (value < kMinDbm) return kMinDbm;
    if (value > kMaxDbm) return kMaxDbm;
    return roundf(value * 2.0f) / 2.0f;
}

inline int8_t requestedQuarterDbm(float staDbm, float apDbm, bool staEnabled, bool apEnabled) {
    const float sta = normalize(staDbm);
    const float ap = normalize(apDbm);
    const float selected = apEnabled ? (staEnabled && sta > ap ? sta : ap) : sta;
    return static_cast<int8_t>(selected * 4.0f);
}
}  // namespace WifiPowerPolicy
