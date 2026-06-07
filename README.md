# Set Template — Ableton Live Extension

Save and restore track layouts as reusable templates. Right-click any track to capture your current setup — names, types, and colors — then replay it in any future set.

## What it does

**Save Track Layout…** — reads every track in your set and saves it as a named JSON template in `~/Ableton Track Templates/`. The dialog shows a preview of all tracks before saving.

**Load Track Template…** — lists your saved templates with a track-by-track preview, then creates matching tracks (MIDI or audio, same names and colors) in your current set.

## Requirements

- Ableton Live 12 Suite, version 12.4.5 beta or later
- Node.js v22 or later (to build from source)
- The Ableton Extensions SDK (see below)

## Building from source

The SDK tarballs are distributed through Ableton's beta program and are not included in this repo. Once you have them:

1. Place `ableton-extensions-sdk-1.0.0-beta.0.tgz` and `ableton-extensions-cli-1.0.0-beta.0.tgz` in the project root.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build:
   ```sh
   npm run build
   ```
   The compiled extension lands in `dist/extension.js`.

4. For live development with auto-rebuild:
   ```sh
   npm run dev
   ```

5. To run directly inside Live (requires Live to be open):
   ```sh
   npm start
   ```

## Installing the built extension

1. In Live: **Settings → Extensions → Install Extension**
2. Select the project folder (which contains `manifest.json`)
3. Right-click any MIDI or audio track to access **Save Track Layout…** and **Load Track Template…**

## Template storage

Templates are saved as `.set-template.json` files in `~/Ableton Track Templates/`. They are plain JSON and can be version-controlled, shared, or edited by hand.

Example template file:

```json
{
  "version": "1",
  "name": "Band Session",
  "createdAt": "2026-06-07T12:00:00.000Z",
  "tracks": [
    { "name": "Drums", "type": "audio", "color": 16711680 },
    { "name": "Bass", "type": "midi", "color": 5592405 },
    { "name": "Guitar", "type": "audio", "color": 43520 },
    { "name": "Keys", "type": "midi", "color": 16776960 }
  ]
}
```

## Project structure

```
src/
  extension.ts      # Extension entry point and all SDK logic
  types.ts          # Shared TypeScript interfaces
  save-dialog.html  # UI for naming and saving a template
  load-dialog.html  # UI for browsing and loading templates
esbuild.js          # Build script
manifest.json       # Extension metadata
package.json
tsconfig.json
```

## License

MIT
