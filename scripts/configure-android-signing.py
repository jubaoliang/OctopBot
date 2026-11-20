"""Point the generated Android release build at a real signing config.

`expo prebuild` writes a Gradle template whose release buildType is signed with
the debug keystore, which cannot be distributed. This swaps in a release signing
config that reads its credentials from the environment, so no secret ever lands in
a file that could be committed.

Run after `npx expo prebuild --platform android`, before `./gradlew assembleRelease`.
"""

import os
import pathlib
import re
import sys

GRADLE_FILE = pathlib.Path("android/app/build.gradle")

REQUIRED_ENV = (
    "ANDROID_KEYSTORE_PATH",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
)

RELEASE_CONFIG = """        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
"""


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        fail("missing environment variable(s): " + ", ".join(missing))

    if not GRADLE_FILE.exists():
        fail(f"{GRADLE_FILE} not found — run `npx expo prebuild --platform android` first")

    source = GRADLE_FILE.read_text()
    if "signingConfigs.release" in source:
        print("release signing already configured, nothing to do")
        return

    anchor = "    signingConfigs {\n"
    if anchor not in source:
        fail("signingConfigs block not found — the Expo Gradle template changed")
    source = source.replace(anchor, anchor + RELEASE_CONFIG, 1)

    pattern = re.compile(
        r"(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug"
    )
    source, count = pattern.subn(r"\1signingConfig signingConfigs.release", source, count=1)
    if count != 1:
        fail("release buildType no longer references the debug signing config — the Expo Gradle template changed")

    GRADLE_FILE.write_text(source)
    print("release signing configured")


if __name__ == "__main__":
    main()
