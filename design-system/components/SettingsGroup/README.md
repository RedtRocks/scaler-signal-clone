# SettingsGroup

Inset grouped list from the Figma settings screens: a white card with 12px radius on #f0f0f0, made of 52px rows.

- Rows (`SettingsRow`): a 24px leading icon in #3c3c3c (or a 38px avatar for members), an 18px label, an optional #858585 value (Off, Admin, 0), and a chevron. Hairlines are #cdcdcd at 50%, inset 58px from the left.
- `title` adds an 18px semibold header above the card ("3 Members", "All Media"). `footer` adds a 13px note under it.
- Destructive rows (Leave Group, Block Group) use `ios-destructive` #dd5d52 and drop the chevron.
- This covers the assignment's group admin controls: members list, Add Members, Admin labels, Leave Group, plus the settings placeholders for privacy, notifications and appearance.
