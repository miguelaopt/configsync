"use client";
import { Toaster as Sonner, toast } from "sonner";

/** Error toast; limit errors get a "See plans" action so the way out is one click. */
export function toastError(message: string) {
  if (message.includes("upgrade to Pro"))
    toast.error(message, {
      duration: 6000,
      action: (
        <a
          href="/pricing"
          className="ml-auto h-7 rounded-xs bg-raised px-2 text-xs leading-7 font-medium text-ink hover:bg-line"
        >
          See plans
        </a>
      ),
    });
  else toast.error(message);
}

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: 72 }}
      mobileOffset={{ bottom: 80 }}
      duration={2500}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-2 rounded-md border border-line bg-overlay px-3.5 py-2.5 text-sm text-ink shadow-menu [&_svg]:size-4 [&_svg]:shrink-0",
          success: "[&_svg]:text-good",
          error: "[&_svg]:text-bad",
          description: "text-xs text-ink-2",
          actionButton:
            "ml-auto h-7 rounded-xs bg-raised px-2 text-xs font-medium text-ink hover:bg-line",
        },
      }}
    />
  );
}
