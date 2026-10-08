# ConversationRow

One conversation in the list: avatar, name, relative time, a two-line preview, and an unread pill or delivery status.

- Desktop: 48px avatar, 14/20 semibold name, 13/18 preview. The selected row uses `surface-selected` and `radius-lg`.
- Phone (Figma): 58px avatar, 13px gap, name 18px semibold at −3%, preview 16px #858585, time 13px #858585. Rows are 69px tall with 17px between them.
- Sort by most recent activity. Pinned chats sit under a "Pinned" header on phones.
- Time format: `Now`, `25m`, `9:24 AM`, `Thu`, then a date.
- Group previews prefix the sender (`Kai: …`). When your message is last, show its DeliveryStatus instead of a badge.
