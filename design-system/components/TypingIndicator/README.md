# TypingIndicator

Three dots in an incoming bubble while the other person types. The Figma shows them as a 56×38 pill in #e9e9e9 with greys stepping from #b3b5b6 to #6d6f71.

- Show it on a `typing` WebSocket event. Hide it after about 5 seconds without a new event, or when the message arrives.
- The animation stops under `prefers-reduced-motion`.
