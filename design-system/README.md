# Signal

A working design system for a Signal Messenger clone (Next.js + TypeScript). It is built from two sources:

1. **The official Signal screenshots and logo pack** from the assignment, for the desktop layout (Chat, Group Chat; light and dark).
2. **The Figma file "Signal | App Recreation (Community)"**, decoded directly. Its colour variables, text styles, corner radii, spacing and icon vectors are copied exactly, at 1x on its 390×844 iPhone frames. The file also embeds real iOS Signal screenshots, which were used to cross-check the bubble colour.

Below 600px wide, `bundle.css` switches every component to the Figma's phone metrics. Add the `.sg-mobile` class to force them at any width.

## Principles

1. **Messages first.** The chrome is greyscale. The only strong colour on screen is your outgoing bubbles, unread pills and blue text buttons.
2. **Round, not tailed.** Bubbles have 20px corners and no tail. Consecutive bubbles from one sender pinch the corners on the sender's side to 4px.
3. **Privacy shows up as quiet facts.** Encryption, timers and receipts appear as small grey notices and circle glyphs, never as banners.
4. **Inset grouped lists for settings.** Details and settings screens use white 12px cards on #f0f0f0, made of 52px rows with inset hairlines.

## Voice and content

- Signal titles its settings rows in Title Case: "Disappearing Messages", "Chat Color & Wallpaper", "View Safety Number", "Leave Group". Everything else is in sentence case: "Get started", "New group", "Invite friends".
- System events are past-tense sentences: "Julian Smith made you an admin.", "You set disappearing message time to 5 minutes."
- Relative times: `Now`, `25m`, `9:24 AM`, `Thu`, then a date.
- Quick-action labels are lowercase single words: video, audio, muted, search.
- Mocked features say what's missing: "Calls are coming soon".

## Colour

From the Figma's colour variables (Design Elements page):

| Figma variable | Value | Token |
|---|---|---|
| Ultramarine | #3A76F0 | `figma-ultramarine` |
| Primary (bubble) | #305EE7 | `ios-ultramarine` |
| Primary Blue (text buttons) | #3E67E2 | `ios-primary-blue` |
| Background & Message Text | #FFFFFF | `surface-pane-mobile`, `ios-card` |
| Secondary | #E5E5E5 | `ios-secondary` |
| Heading Text | #1B1B1B | `ink` |
| Contact Text | #5E5E5E | `ink-secondary` |
| Message Bar Text | #858585 | `ios-placeholder` |

Additional values read from the Figma's final screens: search, composer and incoming fills #E9E9E9 (`ios-field`); grouped background #F0F0F0; nav bar #F9F9F9; hairline #CDCDCD at 50%; destructive #DD5D52; pill #F6F6F6; bubble text #F8FBFF; bubble time and receipts #D5DEFB; initials avatar #E3E4FD with #3A39EB ink; group avatar #F0D9D7 with #A8261C.

From the official desktop screenshots:

| Role | Token | Light | Dark |
|---|---|---|---|
| Accent / outgoing bubble | `ultramarine` | #2c6bed | #2c6bed |
| Chat pane | `surface-pane` | #ffffff | #1a1a1a |
| Rail + list column | `surface-sidebar` | #f6f6f6 | #262626 |
| Selected row | `surface-selected` | #dedede | #474747 |
| Incoming bubble | `bubble-incoming` | #e9e9e9 | #3b3b3b |
| Dividers | `divider` | #d8d8d8 | #404040 |

- The outgoing bubble is **#2c6bed on desktop** (official desktop screenshots) and **#305ee7 on phones** (Figma, matching the real iOS screenshot it embeds). Phone dark mode is true black. Desktop dark mode is #1a1a1a / #262626.
- `brand-ultramarine` #3b45fd is the logo ink only.
- Contrast: #858585 on white is 3.7:1, which is below 4.5:1. It is kept to match the Figma, and `ink-secondary` #5e5e5e is used where text must be read.

## Typography

The Figma uses **SF Pro** (Regular, Medium, Semibold). The font stack resolves to SF on Apple devices and falls back to Inter (Google Fonts) elsewhere. SF Pro can't be self-hosted on the web.

Phone styles, exact from the Figma:

| Style | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|
| `ios-nav-title` | 18 / 22 | 600 | −3% | "Chats", section headers |
| `ios-row-name` | 18 / 22 | 600 | −3% | conversation name |
| `ios-row-preview` | 16 / 20 | 400 | −3% | preview (#858585) |
| `ios-time` | 13 / 16 | 400 | −2% | row time, bubble time |
| `ios-bubble` | 18 / 22.5 | 400 | −3% | message text |
| `ios-body` | 18 / 22 | 400 | −3% | settings rows, inputs |
| `ios-profile-name` | 28 / 34 | 600 | −1% | contact details |
| `ios-action-label` | 12 / 14 | 400 | +6% | quick-action tiles |
| `ios-tab-label` | 11 / 13 | 500 | −3% | tab bar |

Desktop sizes (14px body, 20px title) are estimated from the official screenshots. The Figma has no desktop frames.

## Layout

```
DESKTOP ≥ 900px                                              PHONE < 600px (Figma)
┌──────┬────────────────────┬──────────────────────────┐     ┌─────────────────────────┐
│ Rail │ Chats      ✎  ⋯    │ (o) Maya Johnson  📹📞🔍⋯ │     │ (o)     Chats     📷  ✎ │
│ 68px │ [ Search        ]  │                          │     │ [ Search              ] │
│      │ ▌Family      20m   │          [outgoing]      │     │ (o) Emily's 27th    Now │
│      │  Paige Hall  40m   │ [incoming]               │     │ (o) Cooking Mania   25m │
│      │      320px         │ ☺ [ Message ]  ◰ 🎤 +    │     │ Get started  [card][card]│
└──────┴────────────────────┴──────────────────────────┘     │   💬 Chats     ▢ Stories │
                                                             └─────────────────────────┘
```

- **Desktop:** NavRail, conversation list and chat pane. The rail and list share `surface-sidebar`, separated by `divider` lines.
- **Phone (Figma):** 16px gutters. The header has your avatar, "Chats" centred, then camera and compose. Below it: a 38px search field, 69px rows with 17px gaps, the Get started carousel, and a TabBar. A chat has a back chevron, a 38px avatar, the name with a verified badge, then video and phone. Settings and details screens use ProfileHeader, QuickActions and SettingsGroup on #f0f0f0.

## Shapes and spacing

- Radii: `radius-bubble` 20 and `radius-bubble-joined` 4 (Figma 19.8 / 3.96). `radius-field` 10 for search and tiles. `radius-card` 12 for list groups and cards. `radius-pill` for the composer, pills and avatars.
- Phone spacing (Figma): gutter 16, row gap 17, avatar gap 13, bubble padding 7×13, 2px between grouped bubbles. Settings rows are 52px with hairlines inset 58px.
- Shadows only on floating layers: `shadow-card` (0 0 32px at 20%, Get started), `shadow-popover`, `shadow-modal`.

## Iconography

The **Icons** group and the `Icon` component carry the Figma's own vectors: camera, compose, search, back, chevron, plus, sticker, mic, send, phone, video, muted, disappearing, chat colour, sounds, contact, safety number, verified, requests, permissions, block, dismiss and the tab glyphs. Read receipts are the Figma's double circles (`DeliveryStatus`). The few desktop-only glyphs (menu, more, settings, emoji, lock, note) are drawn as 1.6-stroke lines to sit alongside them.

## Logo

The Logos group holds the supplied SVGs. Use the lockup on onboarding and splash screens, and the mark for the favicon. Never recolour or redraw it.

## Components → assignment features

| Feature | Components |
|---|---|
| Onboarding / OTP / profile | Button, Modal, Avatar, ProfileHeader |
| Conversation list | NavRail / TabBar, SearchField, ConversationRow, UnreadBadge, GetStartedCard |
| 1:1 messaging | ChatHeader, MessageBubble (grouped runs), DeliveryStatus, TypingIndicator, SystemNotice, Composer |
| Groups + admin | MessageBubble (sender + avatar), SettingsGroup / SettingsRow (members, Admin, Add Members, Leave / Block), Modal |
| Contact details / settings placeholders | ProfileHeader, QuickActions, SettingsGroup |
| Toasts / placeholders | Toast, ComingSoon |

**In Next.js:** copy `tokens.css` and `components/bundle.css` into `app/globals.css`. Set `data-theme="dark"` on `<html>` for dark mode. Port each component to `.tsx`, using `index.d.ts` as the prop contract.
