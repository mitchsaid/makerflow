"use client";

import { useState, useTransition } from "react";
import { TextAreaField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { saveJobNote } from "./actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
const MAX = 2000;

/** The maker's own note on a job: how it is made, what to remember. Never shown to the customer. */
export function JobNote({ jobId, initial }: { jobId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setJustSaved(false);
    if (text.trim().length > MAX) {
      setError(`Keep the note to ${MAX} characters or fewer. It is ${text.trim().length} now.`);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await saveJobNote(jobId, text);
        if (result.status === "saved") {
          setSaved(text.trim());
          setJustSaved(true);
        } else if (result.status === "error") setError(result.message);
      } catch {
        setError(OFFLINE);
      }
    });
  }

  return (
    <form onSubmit={save} noValidate className="space-y-3">
      <TextAreaField
        id="job-note"
        label="Private note (optional)"
        hint="Only you and your team see this."
        value={text}
        onChange={(value) => {
          setText(value);
          setJustSaved(false);
        }}
        error={error}
        rows={4}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save note"}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {justSaved ? (saved === "" ? "Note cleared." : "Note saved.") : ""}
        </p>
      </div>
    </form>
  );
}
