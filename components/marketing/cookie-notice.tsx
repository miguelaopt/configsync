"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shared so the founder offer can wait its turn instead of landing on top of this. */
export const COOKIE_NOTICE_SEEN = "configsync:cookie-notice";

export const cookieNoticeDismissed = () => {
  try {
    return Boolean(localStorage.getItem(COOKIE_NOTICE_SEEN));
  } catch {
    return true; // no storage to remember a dismissal ⇒ never show it at all
  }
};

/** localStorage as an external store: the server cannot read it, so it renders as dismissed. */
const subscribe = (onChange: () => void) => {
  window.addEventListener(COOKIE_NOTICE_SEEN, onChange);
  return () => window.removeEventListener(COOKIE_NOTICE_SEEN, onChange);
};

/**
 * A statement, not a consent gate.
 *
 * Signed out the site sets no cookies, and signing in sets only a session cookie — strictly
 * necessary, and exempt from consent under the ePrivacy rules. So there is no Accept and no
 * Reject: buttons that pretend to gate something that was never gated are theatre, and they
 * would contradict /privacy. It says what happens and gets out of the way.
 */
export function CookieNotice() {
  const dismissed = React.useSyncExternalStore(
    subscribe,
    cookieNoticeDismissed,
    () => true, // server render: hidden, so there is nothing to mismatch on hydration
  );
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(COOKIE_NOTICE_SEEN, "1");
    } catch {
      // it will simply be shown again next visit
    }
    window.dispatchEvent(new Event(COOKIE_NOTICE_SEEN));
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4"
    >
      <div className="panel flex w-full max-w-2xl flex-col gap-3 p-4 shadow-dialog sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-[13px] leading-relaxed text-ink-2">
          This site sets no cookies until you sign in, and then only one that keeps you signed in.
          No analytics, no tracking, nothing shared.{" "}
          <Link href="/privacy#cookies" className="text-accent-text hover:text-ink">
            How we handle data
          </Link>
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 self-end sm:self-auto"
          onClick={dismiss}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
