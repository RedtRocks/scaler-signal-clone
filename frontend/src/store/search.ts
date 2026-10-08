import { create } from "zustand";
import { api } from "@/lib/api";
import type { SearchResults } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 250;

interface SearchState {
  /** Also filters the conversation list by title, instantly. */
  query: string;
  /** Server results (conversations, contacts, messages) for the current query. */
  results: SearchResults | null;
  loading: boolean;
  setQuery: (query: string) => void;
  reset: () => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export const useSearchStore = create<SearchState>()((set, get) => {
  const runSearch = async (query: string) => {
    try {
      const results = await api.search(query.trim());
      if (get().query === query) set({ results, loading: false });
    } catch {
      if (get().query === query) set({ results: null, loading: false });
    }
  };

  return {
    query: "",
    results: null,
    loading: false,

    setQuery: (query) => {
      clearTimeout(debounceTimer);
      const active = query.trim() !== "";
      set({ query, loading: active, results: active ? get().results : null });
      if (active) debounceTimer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    },

    reset: () => {
      clearTimeout(debounceTimer);
      set({ query: "", results: null, loading: false });
    },
  };
});
