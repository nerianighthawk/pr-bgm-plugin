#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

VERSION_PATTERN = re.compile(r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def parse_version(value: str) -> tuple[int, int, int]:
    match = VERSION_PATTERN.fullmatch(value)
    if not match:
        raise ValueError(f"Invalid semantic version: {value!r}")
    return tuple(int(part) for part in match.groups())


def next_version(commit_subject: str, latest_tag: str, manifest_path: Path) -> str:
    if commit_subject.startswith("[Major]"):
        increment = "major"
    elif commit_subject.startswith("[Minor]"):
        increment = "minor"
    elif commit_subject.startswith("[Patch]"):
        increment = "patch"
    else:
        raise ValueError("Commit subject must start with [Major], [Minor], or [Patch]")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    current_version = parse_version(manifest["version"])
    release_version = parse_version(latest_tag) if latest_tag else (0, 0, 0)
    major, minor, patch = max(current_version, release_version)

    if increment == "major":
        major, minor, patch = major + 1, 0, 0
    elif increment == "minor":
        major, minor, patch = major, minor + 1, 0
    else:
        major, minor, patch = major, minor, patch + 1

    return f"v{major}.{minor}.{patch}"


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: release_version.py COMMIT_SUBJECT LATEST_TAG MANIFEST")

    try:
        print(next_version(sys.argv[1], sys.argv[2], Path(sys.argv[3])))
    except (OSError, KeyError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(str(error)) from error
