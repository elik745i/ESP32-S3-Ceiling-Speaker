"""Create the cached ELMA runtime payload consumed by the portable launcher."""

from __future__ import annotations

import argparse
import pathlib
import zipfile


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    arguments = parser.parse_args()
    source = arguments.source.resolve()
    output = arguments.output.resolve()
    if not (source / "ELMA-Flasher-Core.exe").is_file():
        parser.error(f"ELMA-Flasher-Core.exe is missing from {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.unlink(missing_ok=True)
    with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source).as_posix())
    temporary.replace(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
