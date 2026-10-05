import { describe, expect, it } from "vitest";
import {
  addRecentSearch,
  clearRecentSearches,
  RECENT_SEARCH_LIMIT,
} from "../src/services/storage/StorageService";
import type { RecentSearch } from "../src/types";

const at = (query: string, time: number): RecentSearch => ({ query, at: time });

describe("addRecentSearch", () => {
  it("adds a new search to the front", () => {
    expect(addRecentSearch([at("old", 1)], "new", 2)).toEqual([at("new", 2), at("old", 1)]);
  });

  it("dedupes case-insensitively and promotes the repeat to the front", () => {
    const existing = [at("React", 1), at("Vue", 2)];
    expect(addRecentSearch(existing, "react", 3)).toEqual([at("react", 3), at("Vue", 2)]);
  });

  it("ignores an existing entry's surrounding whitespace when deduping", () => {
    expect(addRecentSearch([at("React", 1)], "  REACT  ", 2)).toEqual([at("REACT", 2)]);
  });

  it("trims the stored query", () => {
    expect(addRecentSearch([], "  spaced  ", 1)[0]?.query).toBe("spaced");
  });

  it("ignores an empty query", () => {
    expect(addRecentSearch([at("a", 1)], "   ", 2)).toEqual([at("a", 1)]);
  });

  it(`caps at ${RECENT_SEARCH_LIMIT}, keeping the most recent`, () => {
    let list: RecentSearch[] = [];
    for (let index = 0; index < 25; index += 1) {
      list = addRecentSearch(list, `q${index}`, index);
    }
    expect(list).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(list[0]?.query).toBe("q24");
    expect(list[RECENT_SEARCH_LIMIT - 1]?.query).toBe("q10");
  });

  it("returns the same array when nothing changes", () => {
    const existing = [at("a", 1)];
    expect(addRecentSearch(existing, "  ", 2)).toBe(existing);
  });
});

describe("clearRecentSearches", () => {
  it("empties the list", () => {
    expect(clearRecentSearches()).toEqual([]);
  });
});
