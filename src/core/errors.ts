/** A failure explained to the user: the CLI prints the message and exits with code 1. */
export class AtlasError extends Error {}

/** GitHub's rate limit: it stops a whole organization's scan, not only one repository's. */
export class RateLimitError extends AtlasError {}
