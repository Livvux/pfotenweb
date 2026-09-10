#!/usr/bin/env python3
"""Check the tracked self-hosted tree before publishing (no network access)."""
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
policy = json.loads((root / ".github/self-hosted-policy.json").read_text())
paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
errors = []
for name in filter(None, paths):
    path = root / name
    if name not in policy["files"]:
        errors.append(f"Unapproved file: {name}")
    if path.is_symlink():
        errors.append(f"Symlink not permitted: {name}")
        continue
    if not path.is_file():
        continue
    if name.startswith(("src/", "drizzle/")) or name == ".env.example":
        text = path.read_text(errors="replace")
        for pattern in policy["forbiddenPatterns"]:
            if re.search(pattern, text, re.IGNORECASE):
                errors.append(f"Cloud-only marker in: {name}")
                break
package = json.loads((root / "package.json").read_text())
for section in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
    for name in package.get(section, {}):
        if name not in policy["dependencies"]:
            errors.append(f"Unapproved dependency: {name}")
if package.get("license") != "MIT":
    errors.append("Self-hosted package must retain its MIT license declaration")
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print("Self-hosted file and dependency boundary: OK")
