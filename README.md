# Set Template — Ableton Live Extension

Save and restore Ableton Live track layouts as reusable templates. Right-click any MIDI or audio track to capture the current set's track names and track types, then recreate that layout in another set.

## What It Does

**Save Track Layout** reads every regular track in the current set and saves a named JSON template in `~/Ableton Track Templates/`.

**Load Track Template** lists saved templates with a track-by-track preview, then creates matching MIDI/audio tracks and restores their names.

Track colors are not saved because the Ableton Extensions SDK beta exposes clip colors, but not track colors.

## Requirements

- Ableton Live 12 Suite beta with the Extensions host
- Node.js 24.14.1 or newer
- The Ableton Extensions SDK beta tarballs in `vendor/`

## Setup

Install dependencies:

```sh
npm install
```

Set `EXTENSION_HOST_PATH` in `.env` to your local `ExtensionHostNodeModule.node`. On this machine it points inside:

```sh
/Volumes/MZ Music/Ableton Live 12 Beta.app
```

## Scripts

```sh
npm run build      # production bundle in dist/extension.js
npm run build:dev  # dev bundle with sourcemaps
npm start          # build + run in Live's Extension Host
npm run package    # build + create a .ablx archive
```

## Installing In Live

In Live, open **Settings → Extensions → Install Extension**, then select this project folder.

After installation, right-click a MIDI or audio track and choose **Save Track Layout** or **Load Track Template**.

## Template Storage

Templates are saved as `.set-template.json` files in `~/Ableton Track Templates/`.

Example:

```json
{
  "version": "1",
  "name": "Band Session",
  "createdAt": "2026-06-07T12:00:00.000Z",
  "tracks": [
    { "name": "Drums", "type": "audio" },
    { "name": "Bass", "type": "midi" },
    { "name": "Guitar", "type": "audio" },
    { "name": "Keys", "type": "midi" }
  ]
}
```
