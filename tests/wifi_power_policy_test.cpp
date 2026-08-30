#include "../include/wifi_power_policy.h"
#include <assert.h>
#include <limits>

int main() {
    using namespace WifiPowerPolicy;
    assert(normalize(std::numeric_limits<float>::quiet_NaN()) == 15.0f);
    assert(normalize(-1) == 2.0f);
    assert(normalize(30) == 19.5f);
    assert(normalize(10.26f) == 10.5f);
    assert(requestedQuarterDbm(19.5f, 8, true, false) == 78);
    assert(requestedQuarterDbm(19.5f, 8, false, true) == 32);
    assert(requestedQuarterDbm(19.5f, 8, true, true) == 78);
    assert(requestedQuarterDbm(8, 19.5f, true, true) == 78);
    assert(requestedQuarterDbm(15, 15, true, false) == 60);
}
