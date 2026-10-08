import { create } from "zustand";
import { api } from "@/lib/api";
import type { Contact, Id } from "@/lib/types";
import { usePresenceStore } from "./presence";

interface ContactsState {
  contacts: Contact[];
  load: () => Promise<void>;
  add: (phone: string, nickname?: string) => Promise<Contact>;
  rename: (userId: Id, nickname: string | null) => Promise<void>;
  remove: (userId: Id) => Promise<void>;
  reset: () => void;
}

const byName = (a: Contact, b: Contact) => a.display_name.localeCompare(b.display_name);

export const useContactStore = create<ContactsState>()((set) => {
  /** Replaces or adds one contact, keeping the server's name order. */
  const put = (contact: Contact) => {
    usePresenceStore.getState().remember([contact.user]);
    set((state) => ({
      contacts: [...state.contacts.filter((c) => c.user.id !== contact.user.id), contact].sort(byName),
    }));
  };

  return {
    contacts: [],

    load: async () => {
      const contacts = await api.listContacts();
      usePresenceStore.getState().remember(contacts.map((contact) => contact.user));
      set({ contacts });
    },

    add: async (phone, nickname) => {
      const contact = await api.addContact(phone, nickname);
      put(contact);
      return contact;
    },

    rename: async (userId, nickname) => put(await api.renameContact(userId, nickname)),

    remove: async (userId) => {
      await api.removeContact(userId);
      set((state) => ({ contacts: state.contacts.filter((contact) => contact.user.id !== userId) }));
    },

    reset: () => set({ contacts: [] }),
  };
});
