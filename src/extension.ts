import * as ableton from "@ableton-extensions/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import type { TrackRecord, SetTemplate, SaveDialogResult, LoadDialogResult } from "./types.js";
import saveDialogHtml from "./save-dialog.html";
import loadDialogHtml from "./load-dialog.html";

// ── Constants ──────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(os.homedir(), "Ableton Track Templates");
const TEMPLATE_EXT = ".set-template.json";

// ── Helpers ────────────────────────────────────────────────────────────────

async function ensureTemplatesDir(): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
}

async function listTemplates(): Promise<{ name: string; path: string }[]> {
  await ensureTemplatesDir();
  const entries = await fs.readdir(TEMPLATES_DIR);
  return entries
    .filter((f) => f.endsWith(TEMPLATE_EXT))
    .map((f) => ({
      name: f.slice(0, -TEMPLATE_EXT.length),
      path: path.join(TEMPLATES_DIR, f),
    }));
}

async function readTemplate(filePath: string): Promise<SetTemplate> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as SetTemplate;
}

async function writeTemplate(template: SetTemplate): Promise<string> {
  await ensureTemplatesDir();
  const safeName = template.name.replace(/[/\\?%*:|"<>]/g, "-");
  const filePath = path.join(TEMPLATES_DIR, `${safeName}${TEMPLATE_EXT}`);
  await fs.writeFile(filePath, JSON.stringify(template, null, 2), "utf8");
  return filePath;
}

function trackType(track: ableton.Track<"1.0.0">): "midi" | "audio" {
  return track instanceof ableton.MidiTrack ? "midi" : "audio";
}

function colorToHex(color: number): string {
  return "#" + color.toString(16).padStart(6, "0").toUpperCase();
}

function injectData<T>(html: string, key: string, data: T): string {
  const script = `<script>window.${key}=${JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>")};<\/script>`;
  return html.replace("</head>", script + "</head>");
}

// ── Activate ───────────────────────────────────────────────────────────────

export function activate(activation: ableton.ActivationContext) {
  const ctx = ableton.initialize(activation, "1.0.0");

  // ── SAVE TEMPLATE ──────────────────────────────────────────────────────

  ctx.commands.registerCommand("set-template.save", async () => {
    const song = ctx.application.song;

    // Capture current tracks
    const tracks: TrackRecord[] = song.tracks.map((t) => ({
      name: t.name,
      type: trackType(t),
      color: t.color,
    }));

    if (tracks.length === 0) {
      await ctx.ui.showModalDialog(
        `data:text/html,${encodeURIComponent("<html><body><p>No tracks found in the current set.</p></body></html>")}`,
        320,
        120,
      );
      return;
    }

    // Show save dialog
    const tracksWithHex = tracks.map((t) => ({ ...t, colorHex: colorToHex(t.color) }));
    const html = injectData(saveDialogHtml, "TRACKS", tracksWithHex);

    let raw: string;
    try {
      raw = await ctx.ui.showModalDialog(`data:text/html,${encodeURIComponent(html)}`, 480, 520);
    } catch {
      return; // user cancelled
    }

    let result: SaveDialogResult | null = null;
    try {
      result = JSON.parse(raw) as SaveDialogResult;
    } catch {
      return;
    }
    if (!result?.templateName?.trim()) return;

    const template: SetTemplate = {
      version: "1",
      name: result.templateName.trim(),
      createdAt: new Date().toISOString(),
      tracks,
    };

    await writeTemplate(template);
    console.log(`[Set Template] Saved "${template.name}" with ${tracks.length} tracks to ${TEMPLATES_DIR}`);
  });

  // ── LOAD TEMPLATE ──────────────────────────────────────────────────────

  ctx.commands.registerCommand("set-template.load", async () => {
    const templates = await listTemplates();

    if (templates.length === 0) {
      await ctx.ui.showModalDialog(
        `data:text/html,${encodeURIComponent(
          `<html><body style="font-family:sans-serif;padding:20px"><p>No saved templates found.</p><p style="color:#888;font-size:13px">Save a template first by right-clicking a track and choosing <strong>Save Track Layout…</strong></p></body></html>`,
        )}`,
        360,
        160,
      );
      return;
    }

    // Load template previews to pass into dialog
    const previews = await Promise.all(
      templates.map(async ({ name, path: p }) => {
        const tmpl = await readTemplate(p);
        return {
          name,
          path: p,
          trackCount: tmpl.tracks.length,
          createdAt: tmpl.createdAt,
          tracks: tmpl.tracks.map((t) => ({ ...t, colorHex: colorToHex(t.color) })),
        };
      }),
    );

    const html = injectData(loadDialogHtml, "TEMPLATES", previews);

    let raw: string;
    try {
      raw = await ctx.ui.showModalDialog(`data:text/html,${encodeURIComponent(html)}`, 520, 560);
    } catch {
      return;
    }

    let result: LoadDialogResult | null = null;
    try {
      result = JSON.parse(raw) as LoadDialogResult;
    } catch {
      return;
    }
    if (!result?.templatePath) return;

    const template = await readTemplate(result.templatePath);
    const song = ctx.application.song;

    // Create tracks from template
    const created = await ctx.withinTransaction(() =>
      Promise.all(
        template.tracks.map((t) =>
          t.type === "midi" ? song.createMidiTrack() : song.createAudioTrack(),
        ),
      ),
    );

    // Set names and colors
    ctx.withinTransaction(() => {
      created.forEach((track, i) => {
        const record = template.tracks[i];
        if (!record) return;
        track.name = record.name;
        track.color = record.color;
      });
    });

    console.log(`[Set Template] Created ${created.length} tracks from template "${template.name}"`);
  });

  // ── CONTEXT MENU REGISTRATION ──────────────────────────────────────────

  ctx.ui.registerContextMenuAction("MidiTrack", "Save Track Layout…", "set-template.save");
  ctx.ui.registerContextMenuAction("AudioTrack", "Save Track Layout…", "set-template.save");
  ctx.ui.registerContextMenuAction("MidiTrack", "Load Track Template…", "set-template.load");
  ctx.ui.registerContextMenuAction("AudioTrack", "Load Track Template…", "set-template.load");
}
