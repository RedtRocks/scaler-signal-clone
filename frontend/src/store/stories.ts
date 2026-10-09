import { create } from "zustand";
import { api } from "@/lib/api";
import type { Id, Story, StoryBackground } from "@/lib/types";

interface StoriesState {
  stories: Story[];
  loaded: boolean;
  load: () => Promise<void>;
  post: (body: string, background: StoryBackground) => Promise<void>;
  /** A photo story: the picture plus an optional caption. */
  postPhoto: (file: File, caption: string) => Promise<void>;
  /** Marks a story viewed here at once and tells the server. */
  markViewed: (storyId: Id) => void;
  remove: (storyId: Id) => Promise<void>;
  reset: () => void;
}

/** The Stories tab: my stories and those of people I share a chat with (newest first). */
export const useStoryStore = create<StoriesState>()((set, get) => ({
  stories: [],
  loaded: false,
  load: async () => {
    const stories = await api.listStories();
    set({ stories, loaded: true });
  },
  post: async (body, background) => {
    const story = await api.createStory(body, background);
    set((state) => ({ stories: [story, ...state.stories] }));
  },
  postPhoto: async (file, caption) => {
    const story = await api.createPhotoStory(file, caption);
    set((state) => ({ stories: [story, ...state.stories] }));
  },
  markViewed: (storyId) => {
    const story = get().stories.find((s) => s.id === storyId);
    if (!story || story.viewed) return;
    set((state) => ({ stories: state.stories.map((s) => (s.id === storyId ? { ...s, viewed: true } : s)) }));
    void api.viewStory(storyId).catch(() => undefined);
  },
  remove: async (storyId) => {
    await api.deleteStory(storyId);
    set((state) => ({ stories: state.stories.filter((s) => s.id !== storyId) }));
  },
  reset: () => set({ stories: [], loaded: false }),
}));
