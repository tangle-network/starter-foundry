#!/usr/bin/env bash
# Unity WebGL batch-mode build. Runs the Unity editor headlessly against
# a Unity project directory, invokes a C# build method, and writes
# output into ./Build/.
#
# Requirements:
#   - Unity Hub + the exact editor version pinned in ProjectVersion.txt
#   - WebGL build support module installed for that editor
#   - Unity license activated (Personal, Pro, Plus, or CI manual license)
#   - Editor-side C# with `[MenuItem]` or `BuildPlayerOptions` method at
#     BuildScript.PerformWebGLBuild (create one at
#     Assets/Editor/Build.cs in the Unity project)
#
# Env vars:
#   UNITY_PROJECT_PATH  absolute path to the Unity project source
#   UNITY_VERSION       Unity version (e.g. 2022.3.42f1); used to
#                       locate the editor binary
#   UNITY_BUILD_METHOD  fully-qualified static C# method, default
#                       BuildScript.PerformWebGLBuild

set -euo pipefail

: "${UNITY_PROJECT_PATH:?UNITY_PROJECT_PATH must point to the Unity project source}"
: "${UNITY_VERSION:?UNITY_VERSION must be set (e.g. 2022.3.42f1)}"

UNITY_BUILD_METHOD="${UNITY_BUILD_METHOD:-BuildScript.PerformWebGLBuild}"
OUTPUT_DIR="$(pwd)/Build"

# Locate the editor binary across macOS / Linux / CI Docker layouts.
if [[ "$OSTYPE" == "darwin"* ]]; then
  UNITY_BIN="/Applications/Unity/Hub/Editor/${UNITY_VERSION}/Unity.app/Contents/MacOS/Unity"
elif [[ -x "/opt/unity/Editor/Unity" ]]; then
  UNITY_BIN="/opt/unity/Editor/Unity"   # unityci/editor Docker image
else
  UNITY_BIN="${HOME}/Unity/Hub/Editor/${UNITY_VERSION}/Editor/Unity"
fi

if [[ ! -x "$UNITY_BIN" ]]; then
  echo "error: Unity editor binary not found at $UNITY_BIN" >&2
  echo "       set UNITY_VERSION to a Unity Hub-installed editor" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Unity: $UNITY_BIN"
echo "Project: $UNITY_PROJECT_PATH"
echo "Method: $UNITY_BUILD_METHOD"
echo "Output: $OUTPUT_DIR"

"$UNITY_BIN" \
  -batchmode \
  -nographics \
  -quit \
  -logFile - \
  -projectPath "$UNITY_PROJECT_PATH" \
  -executeMethod "$UNITY_BUILD_METHOD" \
  -buildTarget WebGL \
  -webglOutputPath "$OUTPUT_DIR" \
  -silent-crashes

echo "unity webgl build complete → $OUTPUT_DIR"
