export type SearchErrorCode =
  | "EMPTY_QUERY"
  | "NO_SOURCES"
  | "NOT_CONFIGURED"
  | "INVALID_ENGINE"
  | "BAD_API_KEY"
  | "PLAN_REQUIRED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR";

const MESSAGES: Record<SearchErrorCode, string> = {
  EMPTY_QUERY: "Type something to search for first.",
  NO_SOURCES: "No sources are enabled, so there is nothing to search. Enable at least one source in settings.",
  NOT_CONFIGURED: "This search provider is not set up yet. Add an API key or switch back to the search engine.",
  INVALID_ENGINE: "The configured search engine URL is not usable.",
  BAD_API_KEY: "Brave rejected the API key. Check it in settings and save it again.",
  PLAN_REQUIRED: "Your Brave Search plan does not cover this request. Check your plan quota or use the search engine instead.",
  RATE_LIMITED: "Brave is rate-limiting these requests. Wait a moment and try again.",
  PROVIDER_ERROR: "The search provider failed to answer. Try again in a moment.",
  NETWORK_ERROR: "Could not reach the search provider. Check your connection and try again.",
};

export class SearchError extends Error {
  readonly code: SearchErrorCode;
  readonly userMessage: string;

  constructor(code: SearchErrorCode, options?: { cause?: unknown; userMessage?: string }) {
    super(MESSAGES[code], options);
    this.name = "SearchError";
    this.code = code;
    this.userMessage = options?.userMessage ?? MESSAGES[code];
  }
}

export function toSearchError(error: unknown): SearchError {
  if (error instanceof SearchError) return error;
  return new SearchError("PROVIDER_ERROR", { cause: error });
}

export function describeError(error: unknown): string {
  return toSearchError(error).userMessage;
}
