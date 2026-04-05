/**
 * Build the URL for an F1 static live-timing archive file given a session.
 *
 * Archive layout:
 *   https://livetiming.formula1.com/static/
 *     {year}/
 *       {race_date}_{Meeting_Name}/
 *         {session_date}_{Session_Name}/
 *           Position.z.jsonStream
 *
 * Notes:
 * - The meeting folder uses the date of the main RACE session, not the
 *   first session (Friday practice). Both dates are in UTC.
 * - Names in folder paths are the short `meeting_name` / `session_name`
 *   fields (not the `meeting_official_name`), with spaces replaced by
 *   underscores. Session names with numbers keep the number
 *   (e.g. "Practice 1" → "Practice_1").
 * - A small fixup table handles edge cases where OpenF1's name and the
 *   F1 archive name diverge (e.g. official re-brandings).
 */
import type { Meeting, Session } from "@/lib/openf1/types";

const ARCHIVE_BASE = "https://livetiming.formula1.com/static";

/**
 * OpenF1 meeting_name → F1 archive meeting folder name overrides.
 * Only add entries where the automatic transform (spaces→underscores)
 * doesn't match what F1 uses in the archive path.
 */
const MEETING_NAME_FIXUPS: Record<string, string> = {
  // F1 sometimes uses different casing or punctuation; extend as bugs are found.
};

/** Convert a display name to the underscore-joined folder form. */
function toFolderName(name: string, fixups: Record<string, string>): string {
  if (fixups[name]) return fixups[name];
  return name.trim().replace(/\s+/g, "_");
}

/** Extract the YYYY-MM-DD date portion (UTC) from an ISO timestamp. */
function utcDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Build the Position.z archive URL for a given session. Needs the session
 * itself plus its meeting (for the race-date meeting folder) and the
 * session list for that meeting (to find the Race session's date).
 */
export function buildPositionArchiveUrl(
  session: Session,
  meeting: Meeting,
  meetingSessions: Session[]
): string {
  const year = session.year;

  // Meeting folder date = date of the Grand Prix race session. Match on
  // session_name strictly: on sprint weekends the Sprint also has
  // session_type === "Race", which would otherwise shadow the real race.
  // Fall back to the latest session if (somehow) no "Race" session exists.
  const race =
    meetingSessions.find((s) => s.session_name === "Race") ??
    [...meetingSessions].sort(
      (a, b) =>
        new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
    )[0];

  if (!race) {
    throw new Error(
      `Cannot build archive URL: no sessions found for meeting ${meeting.meeting_key}`
    );
  }

  const meetingDate = utcDate(race.date_start);
  const meetingName = toFolderName(meeting.meeting_name, MEETING_NAME_FIXUPS);
  const sessionDate = utcDate(session.date_start);
  const sessionName = toFolderName(session.session_name, {});

  return `${ARCHIVE_BASE}/${year}/${meetingDate}_${meetingName}/${sessionDate}_${sessionName}/Position.z.jsonStream`;
}
