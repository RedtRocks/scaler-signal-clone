# MessageBubble

A message bubble with 20px corners (Figma 19.8). It has no tail. Grouped runs pinch the sender-side corners to 4px.

- `position`: `single` (all round), `first` (bottom sender corner 4px), `middle` and `last` (top and bottom sender corners 4px), exactly as in the Figma's two-bubble run. Bubbles in a run sit 2px apart. A new run starts 8px below the last one.
- Phone (Figma): outgoing #305ee7 with #f8fbff text and #d5defb time/receipts. Incoming #e9e9e9 with #1b1b1b text. Text 18px, line height 22.5px, −3% tracking. Padding 7×13px.
- Desktop (official screenshots): outgoing `ultramarine` #2c6bed, incoming #e9e9e9 / #3b3b3b dark, 14px text.
- Group incoming runs show the sender name on the first bubble and the 28px avatar on the last.
- `quote` renders a reply-to block. `reaction` hangs an emoji pill off the bottom edge. `chatColor` overrides the outgoing fill per chat.
