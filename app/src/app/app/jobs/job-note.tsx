"use client";

import { PrivateTag } from "@/components/private-tag";
import { useState } from "react";
import { TextAreaField } from "@/components/form-fields";
import { useAutoSave, type AutoSaveResult } from "@/components/use-auto-save";
import { saveJobNote } from "./actions";

const MAX = 2000;

/**
 * The maker's own note on a job: how it is made, what to remember. Never shown to the customer. It saves itself (no
 * Save button): a moment after the typing stops and when the box is left.
 */
export function JobNote({ jobId, initial }: { jobId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const { state, touch, flush } = useAutoSave({
    value: text,
    initial: initial.trim(),
    save: async (value): Promise<AutoSaveResult> => {
      const trimmed = value.trim();
      if (trimmed.length > MAX) return { ok: false, message: `Keep the note to ${MAX} characters or fewer. It is ${trimmed.length} now.` };
      const result = await saveJobNote(jobId, trimmed);
      return result.status === "error" ? { ok: false, message: result.message } : { ok: true };
    },
  });

  return (
    <div className="space-y-2" onBlur={flush}>
      <TextAreaField
        id="job-note"
        label="Note (optional)"
        tag={<PrivateTag id="job-note-tag" />}
        value={text}
        onChange={(value) => {
          setText(value);
          touch();
        }}
        error={state.status === "error" ? state.message : undefined}
        rows={4}
      />
      <p role="status" className="text-sm text-muted-foreground">
        {state.status === "saving" ? "Saving…" : state.status === "saved" ? (text.trim() === "" ? "Note cleared." : "Note saved.") : ""}
      </p>
    </div>
  );
}
