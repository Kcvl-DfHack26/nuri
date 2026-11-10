#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

[[ $# -eq 3 ]] || fail "Usage: bash $0 <unsigned.zip> <Xcode-built.app> <device identifier>"
archive=$1
template=$2
device=$3
bundle_id=dev.reohakase.nuri.staging

bundle_id_of() {
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$1/Info.plist"
}

[[ -f "$archive" ]] || fail "ZIP not found: $archive"
[[ -f "$template/embedded.mobileprovision" ]] || fail "Build the signing app for the connected iPhone in Xcode first."
[[ $(bundle_id_of "$template") == "$bundle_id" ]] || fail "Set the signing app's Bundle Identifier to $bundle_id."

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
ditto -x -k "$archive" "$work"
app="$work/nuri.app"
[[ $(bundle_id_of "$app") == "$bundle_id" ]] || fail "The ZIP must contain nuri.app with Bundle Identifier $bundle_id."
[[ -z $(find "$app" -name '*.appex' -print) ]] || fail "The app contains an extension that needs its own provisioning profile."

codesign --display --extract-certificates="$work/certificate" \
  --entitlements "$work/entitlements.plist" --xml "$template"
[[ -s "$work/certificate0" && -s "$work/entitlements.plist" ]] || fail "Build the signing app with Apple Development signing in Xcode."
identity=$(shasum -a 1 "$work/certificate0" | awk '{print toupper($1)}')
identities=$(security find-identity -v -p codesigning)
[[ "$identities" == *"$identity"* ]] || fail "The Xcode signing certificate and its private key must be available in Keychain."
cp "$template/embedded.mobileprovision" "$app/embedded.mobileprovision"

if [[ -d "$app/Frameworks" ]]; then
  find "$app/Frameworks" -depth \( -name '*.framework' -type d -o -name '*.dylib' -type f \) -print0 > "$work/frameworks"
  while IFS= read -r -d '' framework; do
    codesign --force --sign "$identity" "$framework"
  done < "$work/frameworks"
fi

codesign --force --sign "$identity" --entitlements "$work/entitlements.plist" --generate-entitlement-der "$app"
codesign --verify --deep --strict "$app"
xcrun devicectl device install app --device "$device" "$app"
