from pathlib import Path
import gzip
import re

Import("env")

ROOT = Path(env["PROJECT_DIR"])
WEB_DIR = ROOT / "web"
HEADER = ROOT / "include" / "generated_web_assets.h"
SOURCE = ROOT / "src" / "generated_web_assets.cpp"


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


def prepare_payload(path: Path) -> bytes:
    raw = path.read_bytes()
    if path.suffix.lower() == ".html":
        return minify_html(raw.decode("utf-8")).encode("utf-8")
    if path.suffix.lower() == ".css":
        return minify_css(raw.decode("utf-8")).encode("utf-8")
    return raw


assets = []
for path in sorted(WEB_DIR.glob("*")):
    if not path.is_file():
        continue
    raw = prepare_payload(path)
    gzip_encoded = is_gzip_payload(raw)
    payload = raw if gzip_encoded else gzip.compress(raw, compresslevel=9)
    mime = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
    }.get(path.suffix.lower(), "application/octet-stream")
    symbol = path.stem.replace("-", "_") + path.suffix.replace(".", "_")
    assets.append((path.name, symbol, mime, payload, gzip_encoded or is_gzip_payload(payload)))

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

for file_name, symbol, _, payload, _ in assets:
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
for file_name, symbol, mime, _, gzip_encoded in assets:
    source_lines.append(
        f'    {{"/{file_name}", "{mime}", {symbol}, {symbol}_len, {str(gzip_encoded).lower()}}},'
    )
source_lines.append("};")
source_lines.append("const size_t WEB_ASSET_COUNT = sizeof(WEB_ASSETS) / sizeof(WEB_ASSETS[0]);")

HEADER.write_text("\n".join(header_lines) + "\n", encoding="utf-8")
SOURCE.write_text("\n".join(source_lines) + "\n", encoding="utf-8")
