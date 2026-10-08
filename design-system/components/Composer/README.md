# Composer

Message input bar. The mic and sticker buttons swap to a round blue Send button once there is text.

- Desktop: emoji · [Message] · sticker · mic · attach.
- Phone (Figma): + · [Message with sticker inside] · camera · mic. The input is 38px tall, a #e9e9e9 pill, with 18px text and a #7f7f81 placeholder.
- Enter sends and Shift+Enter adds a newline. Emit a throttled `typing` event on input.
