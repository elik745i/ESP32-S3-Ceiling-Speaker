from pathlib import Path
from functools import lru_cache
import gzip
import re
import shutil
import subprocess

Import("env")

ROOT = Path(env["PROJECT_DIR"])
WEB_DIR = ROOT / "web"
BUILD_WEB_DIR = ROOT / ".web-build"
TMP_WEB_DIR = ROOT / ".tmp-webbundle"
HEADER = ROOT / "include" / "generated_web_assets.h"
SOURCE = ROOT / "src" / "generated_web_assets.cpp"
SKIPPED_WEB_ASSETS = {
    "favicon.ico",
}


def is_gzip_payload(data: bytes) -> bool:
    return len(data) >= 2 and data[0] == 0x1F and data[1] == 0x8B


def c_array(data: bytes) -> str:
    rows = []
    for offset in range(0, len(data), 16):
        chunk = data[offset:offset + 16]
        rows.append(", ".join(f"0x{byte:02x}" for byte in chunk))
    return ",\n    ".join(rows)


def minify_html(text: str) -> str:
    text = re.sub(r"<!--(?!\s*\[if).*?-->", "", text, flags=re.S)
    text = re.sub(r">\s+<", "><", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def minify_css(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*([{}:;,>])\s*", r"\1", text)
    text = text.replace(";}", "}")
    return text.strip()


def minify_svg(text: str) -> str:
    text = re.sub(r"<\?xml.*?\?>", "", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<metadata\b.*?</metadata>", "", text, flags=re.S)
    text = re.sub(r"<sodipodi:namedview\b.*?</sodipodi:namedview>", "", text, flags=re.S)
    text = re.sub(r"\s+xmlns:(?:inkscape|sodipodi)=\"[^\"]*\"", "", text)
    text = re.sub(r"\s+(?:inkscape|sodipodi):[\w.-]+=\"[^\"]*\"", "", text)
    text = re.sub(r">\s+<", "><", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


@lru_cache(maxsize=1)
def has_svgo() -> bool:
    try:
        completed = subprocess.run(
            ["npx", "--no-install", "svgo", "--version"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return False
    return completed.returncode == 0


def optimize_svg(path: Path) -> bytes:
    optimized = minify_svg(path.read_text(encoding="utf-8"))
    if not has_svgo():
        return optimized.encode("utf-8")

    relative_path = path.relative_to(WEB_DIR)
    input_path = TMP_WEB_DIR / relative_path
    output_path = input_path.with_suffix(f"{input_path.suffix}.optimized")
    input_path.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_text(optimized, encoding="utf-8")

    svgo_cmd = [
        "npx",
        "--no-install",
        "svgo",
        "--input",
        str(input_path),
        "--output",
        str(output_path),
        "--multipass",
    ]
    try:
        completed = subprocess.run(
            svgo_cmd,
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return optimized.encode("utf-8")

    if completed.returncode != 0 or not output_path.exists():
        return optimized.encode("utf-8")
    return output_path.read_bytes()


def build_web_assets() -> None:
    if BUILD_WEB_DIR.exists():
        shutil.rmtree(BUILD_WEB_DIR)
    if TMP_WEB_DIR.exists():
        shutil.rmtree(TMP_WEB_DIR)
    BUILD_WEB_DIR.mkdir(parents=True, exist_ok=True)

    esbuild_cmd = [
        "npx",
        "--no-install",
        "esbuild",
        str(WEB_DIR / "app.js"),
        "--bundle",
        "--format=esm",
        "--minify",
        f"--outfile={BUILD_WEB_DIR / 'app.js'}",
    ]
    try:
        subprocess.run(esbuild_cmd, cwd=ROOT, check=True)
    except FileNotFoundError as exc:
        raise SystemExit("Node.js and npm are required to build the bundled web UI.") from exc
    except subprocess.CalledProcessError as exc:
        raise SystemExit(
            "Bundling web assets failed. Run `cmd /c npm install` in the project root to install frontend build dependencies."
        ) from exc

    for path in sorted(WEB_DIR.rglob("*")):
        if not path.is_file():
            continue

        relative_path = path.relative_to(WEB_DIR)
        relative_path_str = relative_path.as_posix()
        if relative_path_str == "app.js" or relative_path_str.startswith("modules/") or relative_path_str in SKIPPED_WEB_ASSETS:
            continue

        target_path = BUILD_WEB_DIR / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(prepare_payload(path))


def prepare_payload(path: Path) -> bytes:
    raw = path.read_bytes()
    if path.suffix.lower() == ".html":
        return minify_html(raw.decode("utf-8")).encode("utf-8")
    if path.suffix.lower() == ".css":
        return minify_css(raw.decode("utf-8")).encode("utf-8")
    if path.suffix.lower() == ".svg":
        return optimize_svg(path)
    return raw


build_web_assets()


assets = []
for path in sorted(BUILD_WEB_DIR.rglob("*")):
    if not path.is_file():
        continue
    relative_path = path.relative_to(BUILD_WEB_DIR).as_posix()
    raw = path.read_bytes()
    gzip_encoded = is_gzip_payload(raw)
    payload = raw if gzip_encoded else gzip.compress(raw, compresslevel=9)
    mime = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
    }.get(path.suffix.lower(), "application/octet-stream")
    symbol_base = re.sub(r"[^0-9a-zA-Z_]+", "_", relative_path)
    symbol = symbol_base.strip("_") or "asset"
    assets.append((relative_path, symbol, mime, payload, gzip_encoded or is_gzip_payload(payload)))

header_lines = [
    "#pragma once",
    "",
    "#include <Arduino.h>",
    "#include <pgmspace.h>",
    "",
    "struct EmbeddedWebAsset {",
    "    const char* path;",
    "    const char* contentType;",
    "    const uint8_t* data;",
    "    size_t size;",
    "    bool gzip;",
    "};",
    "",
]

source_lines = [
    '#include "generated_web_assets.h"',
    "",
]

for asset_path, symbol, _, payload, _ in assets:
    header_lines.append(f"extern const uint8_t {symbol}[];")
    header_lines.append(f"extern const size_t {symbol}_len;")
    source_lines.append(f"const uint8_t {symbol}[] PROGMEM = {{")
    source_lines.append(f"    {c_array(payload)}")
    source_lines.append("};")
    source_lines.append(f"const size_t {symbol}_len = sizeof({symbol});")
    source_lines.append("")

header_lines.append("extern const EmbeddedWebAsset WEB_ASSETS[];")
header_lines.append("extern const size_t WEB_ASSET_COUNT;")

source_lines.append("const EmbeddedWebAsset WEB_ASSETS[] = {")
for asset_path, symbol, mime, _, gzip_encoded in assets:
    source_lines.append(
        f'    {{"/{asset_path}", "{mime}", {symbol}, {symbol}_len, {str(gzip_encoded).lower()}}},'
    )
source_lines.append("};")
source_lines.append("const size_t WEB_ASSET_COUNT = sizeof(WEB_ASSETS) / sizeof(WEB_ASSETS[0]);")

HEADER.write_text("\n".join(header_lines) + "\n", encoding="utf-8")
SOURCE.write_text("\n".join(source_lines) + "\n", encoding="utf-8")
