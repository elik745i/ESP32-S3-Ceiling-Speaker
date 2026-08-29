"""Frozen PlatformIO command runner bundled with ELMA Flasher.

PlatformIO and the Espressif build tools launch helper scripts with
``sys.executable path/to/helper.py``. In a frozen application
``sys.executable`` is this EXE, so dispatch Python scripts explicitly instead
of feeding their paths back into PlatformIO's Click command parser.
"""

import os
import runpy
import sys
from pathlib import Path

from platformio.__main__ import main

# PlatformIO, SCons, and the Espressif tools invoke Python helper scripts via
# ``sys.executable``.  For this one-file build that path points back to this
# runner, sometimes through a non-Python parent process.  PyInstaller 6.22's
# one-file parent validation rejects that process tree unless each helper is
# explicitly started as an independent frozen instance.
if getattr(sys, "frozen", False):
    os.environ["PYINSTALLER_RESET_ENVIRONMENT"] = "1"


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].lower().endswith((".py", ".pyw")):
        script = sys.argv[1]
        sys.argv = sys.argv[1:]
        sys.path.insert(0, str(Path(script).resolve().parent))
        runpy.run_path(script, run_name="__main__")
    else:
        raise SystemExit(main())
