/** Accordion of questions, plus the FAQPage schema so search results can show them inline. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((f) => (
          <details key={f.q} className="panel group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-semibold text-ink">
              {f.q}
              <span
                aria-hidden
                className="mt-1 size-2.5 shrink-0 rotate-45 border-r border-b border-ink-3 transition-transform group-open:-rotate-[135deg]"
              />
            </summary>
            <p className="mt-3 text-[14px] text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        // Our own strings; "<" escaped so no answer could close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
