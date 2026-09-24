import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

/** The one place the app pages offer the Windows installer. */
export function WindowsAppCard({ className }: { className?: string }) {
  return (
    <section className={`panel flex flex-col gap-3 p-5 ${className ?? ""}`}>
      <h2 className="text-[15px] font-semibold text-ink">ConfigSync for Windows</h2>
      <p className="text-[13px] text-ink-2">
        Connect your gaming PC, see which games it has and put a preset on it with one click.
      </p>
      <Button asChild variant="primary" size="lg" className="mt-1 w-full">
        <a href={SITE.windowsApp} download>
          <Download /> Download for Windows
        </a>
      </Button>
      <p className="text-xs text-ink-3">
        Windows 10 and 11. Windows may warn about an unknown app the first time: More info → Run
        anyway.
      </p>
    </section>
  );
}
