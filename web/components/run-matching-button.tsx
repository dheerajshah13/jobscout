"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";

/**
 * Submit button for the "Run AI matching" form. Uses the parent form's pending
 * state (`useFormStatus`) to swap in a spinner and show a full-screen loading
 * overlay while the server action fetches and scores jobs from every source —
 * which takes a few seconds, so the user needs feedback that it's working.
 */
export function RunMatchingButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-md bg-pine px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        disabled={disabled || pending}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {pending ? "Scanning job boards…" : "Run AI matching"}
      </button>

      {pending ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
        >
          <div className="mx-5 max-w-sm rounded-xl border border-line bg-white p-8 text-center shadow-soft">
            <Loader2 size={40} className="mx-auto animate-spin text-pine" />
            <p className="mt-5 text-lg font-bold text-ink">Running AI matching…</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Fetching fresh jobs from every source for your target roles, removing duplicates, and scoring each one
              against your profile. This takes a few seconds.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
