# OctopBot App Icon Design

## Context

OctopBot currently ships Expo template launcher artwork. The upstream Octop repository provides a recognizable red C brand mark at `~/Projects/octop/desktop/src/renderer/src/assets/octop-mark.svg`, but its raster desktop icon has pre-rounded corners and transparency and therefore cannot be reused directly for mobile launcher assets.

The approved direction is **a full-bleed red gradient with a centered white C mark**, rebuilt separately for Apple and Android requirements. The design favors recognition, small-size legibility, adaptive masks, and themed-icon support over mascot detail.

## Source artwork

- Derive the launcher artwork from the upstream vector C, not from the 3D mascot or a pre-rounded raster tile.
- Store a cleaned, self-contained vector source under `assets/branding/` so future assets can be regenerated without depending on another checkout.
- Preserve the C and its four rounded motion bars. Remove decorative blur/filter effects and avoid adding shadows, glows, bevels, text, or a baked-in corner mask.
- Use white foreground artwork over a subtle top-to-bottom brand-red gradient: lighter red `#FF6466` at the top and brand red `#FF0004` at the bottom. These values apply only to image assets, not UI code.

## Apple assets

### Layered icon

Replace the Expo template content in `assets/expo.icon/` with a simple Icon Composer document:

- Use a red gradient background and one white vector foreground layer.
- Keep foreground edges crisp and the primary mark centered.
- Leave system-managed Liquid Glass appearance behavior to Icon Composer and iOS; do not imitate it with custom raster effects.
- Keep the existing `ios.icon` reference in `app.json` pointed at the `.icon` directory.
- Preserve the supported-platform configuration for square icons; do not add unrelated platforms or alternate icons.

### Flattened fallback

Replace `assets/images/icon.png` with a flattened equivalent:

- Exactly 1024×1024 pixels, square and full-bleed.
- Opaque sRGB output with no transparent pixels and no pre-rounded corners.
- Center the white C with generous clearance from all edges so system masking cannot crop it.

These choices follow Apple’s app-icon guidance: https://developer.apple.com/design/human-interface-guidelines/app-icons

## Android assets

Replace the template files referenced by `android.adaptiveIcon` in `app.json`:

- `assets/images/android-icon-background.png`: full-bleed red gradient, opaque, with no logo or mask.
- `assets/images/android-icon-foreground.png`: transparent 108×108 dp-equivalent canvas containing only the white C and its motion bars.
- `assets/images/android-icon-monochrome.png`: the same silhouette and placement as the foreground, using opaque alpha shapes with no color-dependent detail.
- Set the fallback `backgroundColor` to brand red `#FF0004`; keep `backgroundImage` for the gradient.
- Generate foreground, background, and monochrome rasters at the same 1024×1024 dimensions so Expo receives matching layers.

Geometry follows Android’s 108×108 dp layer model:

- Reserve the outer 18 dp on every side for OEM masks and motion.
- Fit the entire C silhouette within the central 66×66 dp safe zone.
- Target approximately 62 dp of horizontal width for the complete mark, preserving its aspect ratio and keeping every element inside the safe zone.
- Do not add shadows or outlines around the silhouette.

These choices follow Android’s adaptive-icon guidance: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive and Expo’s asset guidance: https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/

## Configuration scope

- Preserve all unrelated and currently uncommitted changes in `app.json`.
- Change only launcher icon assets and the Android adaptive-icon background fallback color.
- Do not change the splash screen, in-app SVG icons, favicon, package versions, native signing, application identifiers, or upstream Octop files.
- Do not add a runtime dependency or a new application feature.

## Verification

1. Inspect every generated PNG for exact dimensions, color mode, and alpha behavior; the flattened iOS icon and Android background must be fully opaque.
2. Read back the flattened icon and layered foreground visually to confirm geometry, crisp edges, and brand fidelity.
3. Produce temporary circular, rounded-square, and squircle mask previews to verify that the complete C remains inside Android’s safe zone. Keep temporary previews out of committed source.
4. Preview the monochrome layer using a non-brand tint to ensure it remains recognizable without color or gradients.
5. Validate the resulting public Expo configuration and confirm all referenced files exist.
6. Rebuild and launch the Android development client, then inspect the installed launcher icon on the emulator. iOS rendering remains unverified unless an iOS build is also produced and inspected.
7. Run the repository’s existing lint and typecheck gates after configuration changes, reporting unrelated pre-existing failures separately rather than modifying unrelated source.
