"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Errors clear when the maker fixes the thing (docs/adr/0005-form-errors.md). A form's errors come from its last save,
 * so on their own they would stay until the next save comes back. This scope remembers which fields were edited since
 * that save came back: those fields drop their message, and the summary drops their rows (and its count) at once. A new
 * save result starts a new round, so anything still wrong comes back.
 *
 * A form wraps its content in <FormErrorScope epoch={state}>, where `epoch` is anything that changes each time a save
 * comes back (the action state). The shared fields (TextField and the others in form-fields) report their own edits; a
 * custom control calls `markEdited` with the id the summary links to.
 */

type Scope = {
  epoch: unknown;
  edited: ReadonlySet<string>;
  markEdited: (id: string) => void;
};

const NONE: ReadonlySet<string> = new Set();
const ScopeContext = createContext<Scope | null>(null);

export function FormErrorScope({ epoch, children }: { epoch: unknown; children: React.ReactNode }) {
  const [round, setRound] = useState<{ epoch: unknown; ids: ReadonlySet<string> }>({ epoch, ids: NONE });
  const edited = round.epoch === epoch ? round.ids : NONE;

  const markEdited = useCallback(
    (id: string) =>
      setRound((current) => {
        const ids = current.epoch === epoch ? current.ids : NONE;
        return ids.has(id) ? current : { epoch, ids: new Set(ids).add(id) };
      }),
    [epoch],
  );

  const value = useMemo(() => ({ epoch, edited, markEdited }), [epoch, edited, markEdited]);
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

/** What a field should show: its error, unless it was edited since the error arrived. */
export function useFieldError(id: string, error: string | undefined): { error: string | undefined; markEdited: () => void } {
  const scope = useContext(ScopeContext);
  const markEdited = useCallback(() => scope?.markEdited(id), [scope, id]);
  return { error: scope?.edited.has(id) ? undefined : error, markEdited };
}

/** The ids edited since the last save came back (empty outside a scope). */
export function useEditedFields(): { epoch: unknown; edited: ReadonlySet<string>; markEdited: (id: string) => void } {
  const scope = useContext(ScopeContext);
  return { epoch: scope?.epoch, edited: scope?.edited ?? NONE, markEdited: scope?.markEdited ?? (() => undefined) };
}

/** What a form that owns its own values needs from its scope: which fields were edited, and a way to mark one. */
export type ErrorScopeHandle = { epoch: unknown; edited: ReadonlySet<string>; markEdited: (id: string) => void };

/**
 * A form wraps its content in a FormErrorScope, so it cannot read the scope itself. Rendered inside it, this reports
 * the scope up to the form (`onScope` is a state setter), which then hides stale errors and marks edits made by
 * controls that are not the shared fields. Use `handle.epoch === theEpoch` to ignore a scope that has not caught up.
 */
export function ErrorScopeBridge({ onScope }: { onScope: (handle: ErrorScopeHandle) => void }) {
  const { epoch, edited, markEdited } = useEditedFields();
  useEffect(() => {
    onScope({ epoch, edited, markEdited });
  }, [epoch, edited, markEdited, onScope]);
  return null;
}
