# DeliveryStatus

Signal's circle receipts, built to the Figma geometry: two 13px discs offset 6px (19×13).

- `sending`: dashed ring. `sent`: one outlined circle with a check.
- `delivered`: two outlined circles. `read`: two filled discs. The second disc is cut from the first by a 1px ring in the background colour (`--sg-status-bg`).
- In outgoing bubbles the ink is `ios-bubble-meta` #d5defb (Figma). In lists it is `ink-secondary`.
- Map 1:1 to your `message_status` enum and update it over the WebSocket.
