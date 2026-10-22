"use client";
import { modeString, type Entry } from "@/lib/impact/engine";
export function PermissionEditor({
  entry,
  previewMode,
  onCommand,
}: {
  entry: Entry;
  previewMode?: number;
  onCommand: (command: string) => void;
}) {
  const mode = previewMode ?? entry.mode;
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  return (
    <section className="permission-editor" aria-label="Permission laboratory">
      <h3>Permission laboratory</h3>
      <p>
        Choose a bit to construct a chmod preview. Apply below, then try
        traversal. Only student-owned entries permit chmod.
      </p>
      <div className="permission-bits">
        {["Owner", "Group", "Others"].map((group, i) => (
          <fieldset key={group}>
            <legend>{group}</legend>
            {[4, 2, 1].map((bit, j) => {
              const mask = bit << (6 - i * 3);
              return (
                <label key={bit}>
                  <input
                    type="checkbox"
                    checked={!!(mode & mask)}
                    onChange={() =>
                      onCommand(
                        `chmod ${modeString(mode ^ mask)} ${quote(entry.path)}`,
                      )
                    }
                  />
                  {["read r", "write w", "search / execute x"][j]}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="playback-controls">
        <button
          onClick={() => onCommand(`find ${quote(entry.path)} -maxdepth 1`)}
        >
          Find from selected path
        </button>
        <button onClick={() => onCommand(`rm ${quote(entry.path)}`)}>
          Preview removal
        </button>
      </div>
      <p className="lab-fixture-note">
        Directory r lists names; x searches names. This bounded walker requires
        both to descend. Metadata of a known entry needs ancestor x. Parent w+x
        controls unlink; sticky /lab/tmp protects other owners. No ACLs or root
        elevation.
      </p>
    </section>
  );
}
