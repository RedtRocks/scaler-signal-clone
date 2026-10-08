# Icon

Icons exported vector-for-vector from the Figma file, plus a few desktop-only line glyphs.

- Figma icons (exact geometry): camera, camera-composer, compose, search, search-action, back, chevron-right, plus, sticker, mic, send, phone, video, video-header, muted, disappearing, chat-color, sounds, contact, safety-number, verified, add-member, requests, permissions, leave-group, block, dismiss, tab-chats, tab-stories.
- Desktop-only line glyphs (not in the Figma; drawn in the same weight): menu, more, settings, stories, smile, note, lock, close, timer.
- Everything inherits `currentColor`. A few Figma glyphs cut a white knockout shape; that shape uses `--sg-icon-knock` (defaults to white), so set it to the surface colour on dark grounds. The components already do this.
- Colours: `icon` in chrome, `ios-row-icon` in settings rows, `ios-destructive` for Leave/Block.
- The raw SVGs are also in the **Icons** asset group.
