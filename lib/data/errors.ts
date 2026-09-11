/** Errors that are safe to show to users verbatim. Anything else becomes a generic message. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "forbidden" | "conflict" | "invalid" = "invalid",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) =>
  new AppError(`We couldn't find that ${what}. It may have been deleted.`, "not_found");
