"""Compile selected Wi-Fi power defaults; existing NVS settings take precedence."""
import math
import os


def normalize_power(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 15.0
    if not math.isfinite(number):
        return 15.0
    number = max(2.0, min(19.5, number))
    return math.floor(number * 2.0 + 0.5) / 2.0


def power_defines(environ):
    return [
        (f"APP_DEFAULT_WIFI_{mode}_TX_DBM", f"{normalize_power(environ.get(f'ELMA_{mode}_TX_POWER_DBM')):.1f}f")
        for mode in ("STA", "AP")
    ]


try:
    Import("env")  # PlatformIO/SCons injects Import.
except NameError:
    pass
else:
    env.Append(CPPDEFINES=power_defines(os.environ))
