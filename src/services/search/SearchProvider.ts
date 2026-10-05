import type { ProviderId, SearchOutcome, SearchSource, Settings } from "../../types";

export interface SearchRequest {
  query: string;
  /** Only the sources the user has enabled; callers must filter before calling. */
  sources: SearchSource[];
  settings: Settings;
}

export interface SearchProvider {
  id: ProviderId;
  name: string;
  /** False when the provider needs credentials or a permission it does not have. */
  isConfigured(): Promise<boolean>;
  search(request: SearchRequest): Promise<SearchOutcome>;
}

import { EngineProvider } from "./providers/EngineProvider";
import { BraveApiProvider } from "./providers/BraveApiProvider";

export const PROVIDERS: Record<ProviderId, SearchProvider> = {
  engine: new EngineProvider(),
  "brave-api": new BraveApiProvider(),
};

export function getProvider(id: ProviderId): SearchProvider {
  return PROVIDERS[id];
}
