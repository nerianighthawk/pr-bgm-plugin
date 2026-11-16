#!/usr/bin/env python3
import argparse
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILES = ("manifest.json", "index.html", "main.js", "library.js", "styles.css")
VERSION_PATTERN = re.compile(r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
ZIP_TIMESTAMP = (2024, 1, 1, 0, 0, 0)


def build_packages(version: str, output_dir: Path) -> tuple[Path, Path]:
    match = VERSION_PATTERN.fullmatch(version)
    if not match:
        raise ValueError(f"Invalid semantic version: {version!r}")

    version_number = ".".join(match.groups())
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    manifest["version"] = version_number
    files = {
        "manifest.json": (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    }

    for name in PACKAGE_FILES[1:]:
        files[name] = (ROOT / name).read_bytes()

    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / f"bgm-finder-v{version_number}.zip"
    ccx_path = output_dir / f"bgm-finder-v{version_number}.ccx"

    for package_path in (zip_path, ccx_path):
        with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as package:
            for name in PACKAGE_FILES:
                entry = zipfile.ZipInfo(name, date_time=ZIP_TIMESTAMP)
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = 0o100644 << 16
                package.writestr(entry, files[name])

        with zipfile.ZipFile(package_path) as package:
            if set(package.namelist()) != set(PACKAGE_FILES):
                raise RuntimeError(f"Unexpected files in package: {package_path}")
            packaged_manifest = json.loads(package.read("manifest.json"))
            if packaged_manifest["version"] != version_number:
                raise RuntimeError(f"Incorrect manifest version in package: {package_path}")

    return zip_path, ccx_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build BGM Finder ZIP and CCX packages.")
    parser.add_argument("version", help="Semantic version, for example v1.2.3")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    arguments = parser.parse_args()

    try:
        zip_path, ccx_path = build_packages(arguments.version, arguments.output_dir)
    except (OSError, json.JSONDecodeError, ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from error
    print(f"Created {zip_path}")
    print(f"Created {ccx_path}")
