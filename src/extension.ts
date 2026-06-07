import * as ableton from "@ableton-extensions/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import type { LoadDialogResult, SaveDialogResult, SetTemplate, TrackRecord } from "./types.js";
import loadDialogHtml from "./load-dialog.html";
import saveDialogHtml from "./save-dialog.html";

const TEMPLATES_DIR = path.join(os.homedir(), "Ableton Track Templates");
const TEMPLATE_EXT = ".set-template.json";

async function ensureTemplatesDir(): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
}

async function listTemplates(): Promise<{ name: string; path: string }[]> {
  await ensureTemplatesDir();
  const entries = await fs.readdir(TEMPLATES_DIR);
  return entries
    .filter((file) => file.endsWith(TEMPLATE_EXT))
    .map((file) => ({
      name: file.slice(0, -TEMPLATE_EXT.length),
      path: path.join(TEMPLATES_DIR, file),
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

function trackTypeColor(type: TrackRecord["type"]): string {
  return type === "midi" ? "#8b5cf6" : "#3b82f6";
}

function injectData<T>(html: string, key: string, data: T): string {
  const json = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
  return html.replace("</head>", `<script>window.${key}=${json};</script></head>`);
}

function dialogUrl(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

export function activate(activation: ableton.ActivationContext) {
  const context = ableton.initialize(activation, "1.0.0");

  context.commands.registerCommand("set-template.save", async () => {
    const tracks: TrackRecord[] = context.application.song.tracks.map((track) => ({
      name: track.name,
      type: trackType(track),
    }));

    if (tracks.length === 0) {
      await context.ui.showModalDialog(
        dialogUrl("<html><body><p>No tracks found in the current set.</p></body></html>"),
        320,
        120,
      );
      return;
    }

    const tracksWithHex = tracks.map((track) => ({
      ...track,
      colorHex: trackTypeColor(track.type),
    }));
    const html = injectData(saveDialogHtml, "TRACKS", tracksWithHex);

    let raw: string;
    try {
      raw = await context.ui.showModalDialog(dialogUrl(html), 480, 520);
    } catch {
      return;
    }

    let result: SaveDialogResult | null = null;
    try {
      result = JSON.parse(raw) as SaveDialogResult;
    } catch {
      return;
    }

    if (!result?.templateName?.trim()) {
      return;
    }

    const template: SetTemplate = {
      version: "1",
      name: result.templateName.trim(),
      createdAt: new Date().toISOString(),
      tracks,
    };

    await writeTemplate(template);
    console.log(`[Set Template] Saved "${template.name}" with ${tracks.length} tracks to ${TEMPLATES_DIR}`);
  });

  context.commands.registerCommand("set-template.load", async () => {
    const templates = await listTemplates();

    if (templates.length === 0) {
      await context.ui.showModalDialog(
        dialogUrl(
          '<html><body style="font-family:sans-serif;padding:20px"><p>No saved templates found.</p><p style="color:#888;font-size:13px">Save a template first by right-clicking a track and choosing <strong>Save Track Layout</strong>.</p></body></html>',
        ),
        360,
        160,
      );
      return;
    }

    const previews = await Promise.all(
      templates.map(async ({ name, path: templatePath }) => {
        const template = await readTemplate(templatePath);
        return {
          name,
          path: templatePath,
          trackCount: template.tracks.length,
          createdAt: template.createdAt,
          tracks: template.tracks.map((track) => ({
            ...track,
            colorHex: trackTypeColor(track.type),
          })),
        };
      }),
    );

    const html = injectData(loadDialogHtml, "TEMPLATES", previews);

    let raw: string;
    try {
      raw = await context.ui.showModalDialog(dialogUrl(html), 520, 560);
    } catch {
      return;
    }

    let result: LoadDialogResult | null = null;
    try {
      result = JSON.parse(raw) as LoadDialogResult;
    } catch {
      return;
    }

    if (!result?.templatePath) {
      return;
    }

    const template = await readTemplate(result.templatePath);
    const song = context.application.song;
    const created = await context.withinTransaction(() =>
      Promise.all(
        template.tracks.map((track) =>
          track.type === "midi" ? song.createMidiTrack() : song.createAudioTrack(),
        ),
      ),
    );

    context.withinTransaction(() => {
      created.forEach((track, index) => {
        const record = template.tracks[index];
        if (!record) {
          return;
        }
        track.name = record.name;
      });
    });

    console.log(`[Set Template] Created ${created.length} tracks from template "${template.name}"`);
  });

  context.ui.registerContextMenuAction("MidiTrack", "Save Track Layout", "set-template.save");
  context.ui.registerContextMenuAction("AudioTrack", "Save Track Layout", "set-template.save");
  context.ui.registerContextMenuAction("MidiTrack", "Load Track Template", "set-template.load");
  context.ui.registerContextMenuAction("AudioTrack", "Load Track Template", "set-template.load");
}
