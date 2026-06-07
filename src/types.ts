/** A single track's captured state */
export interface TrackRecord {
  name: string;
  type: "midi" | "audio";
}

/** The saved template file format */
export interface SetTemplate {
  version: "1";
  name: string;
  createdAt: string;
  tracks: TrackRecord[];
}

/** What the save dialog sends back to the extension */
export interface SaveDialogResult {
  templateName: string;
}

/** What the load dialog sends back to the extension */
export interface LoadDialogResult {
  templatePath: string;
}
