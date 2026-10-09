"use client";

import { useState, type ReactNode } from "react";
import {
  AppShell,
  Avatar,
  Button,
  ChatListHeader,
  ComingSoon,
  Composer,
  ContextMenu,
  ConversationRow,
  DateDivider,
  DeliveryStatus,
  DropdownMenu,
  EmptyChatPane,
  EncryptionNotice,
  GetStartedCard,
  ICON_NAMES,
  Icon,
  MenuList,
  MessageActions,
  MessageBubble,
  Modal,
  NavRail,
  OtpInput,
  PhoneInput,
  ProfileHeader,
  QuickActions,
  QuoteBlock,
  RadioGroup,
  ReactionChips,
  ReactionPicker,
  ScrollToBottom,
  SearchField,
  SettingsGroup,
  SettingsRow,
  Spinner,
  Switch,
  SystemNotice,
  TabBar,
  TextField,
  Toast,
  ToastViewport,
  Tooltip,
  TypingIndicator,
  UnreadBadge,
  useContextMenu,
  useThemePreference,
  useToast,
  type MenuEntry,
} from "@/components/ui";
import { ChatPane, GroupSample, ListColumn } from "./demo";
import styles from "./page.module.css";

function Section({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? styles.sectionWide : styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

const MENU_SAMPLE: MenuEntry[] = [
  { label: "Reply", icon: "reply", onSelect: () => {} },
  { label: "Copy text", icon: "copy", onSelect: () => {} },
  { label: "Forward", icon: "forward", onSelect: () => {}, disabled: true },
  { label: "Info", icon: "info", onSelect: () => {} },
  "separator",
  { label: "Delete for everyone", icon: "trash", destructive: true, onSelect: () => {} },
];

function DesktopDemo({ onToast }: { onToast: (m: string) => void }) {
  const [selected, setSelected] = useState<string | undefined>("maya");
  const [rail, setRail] = useState<"chats" | "calls" | "stories">("chats");
  return (
    <div className={styles.desktopFrame}>
      <AppShell
        className={styles.fill}
        rail={
          <NavRail
            active={rail}
            badges={{ chats: 14, stories: 2 }}
            onSelect={setRail}
            onSettings={() => onToast("Settings")}
          />
        }
        list={<ListColumn selected={selected} onSelect={setSelected} onToast={onToast} />}
        pane={
          rail !== "chats" ? (
            <ComingSoon icon={rail === "calls" ? "phone" : "stories"} title={rail === "calls" ? "Calls are coming soon" : "Stories are coming soon"} />
          ) : selected === "maya" ? (
            <ChatPane layout="desktop" onToast={onToast} />
          ) : (
            <EmptyChatPane />
          )
        }
      />
    </div>
  );
}

function PhoneDemo({ initialView, onToast }: { initialView: "list" | "pane"; onToast: (m: string) => void }) {
  const [view, setView] = useState(initialView);
  const [tab, setTab] = useState("chats");
  return (
    <div className={styles.phoneFrame}>
      <AppShell
        forceMobile
        className={styles.fill}
        mobileView={view}
        list={<ListColumn showGetStarted selected={undefined} onSelect={() => setView("pane")} onToast={onToast} />}
        tabBar={<TabBar active={tab} onSelect={setTab} badges={{ chats: 4, stories: 2 }} />}
        pane={<ChatPane layout="mobile" onBack={() => setView("list")} onToast={onToast} />}
      />
    </div>
  );
}

export default function UiGallery() {
  const [theme, changeTheme] = useThemePreference();
  const { toast, show, dismiss } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [sw, setSw] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [country, setCountry] = useState("US");
  const [phone, setPhone] = useState("555 000 0001");
  const [otp, setOtp] = useState("123");
  const [name, setName] = useState("");
  const ctx = useContextMenu();

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <strong>Signal UI gallery</strong>
        <div className={styles.toolbarRight}>
          <RadioGroup
            name="gallery-theme"
            value={theme}
            onChange={changeTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
      </header>

      <h2 className={styles.h}>Desktop shell</h2>
      <DesktopDemo onToast={(m) => show(m)} />

      <h2 className={styles.h}>Phone (390 × 844, .sg-mobile)</h2>
      <div className={styles.phones}>
        <PhoneDemo initialView="list" onToast={(m) => show(m)} />
        <PhoneDemo initialView="pane" onToast={(m) => show(m)} />
        <div className={`${styles.phoneFrame} sg-mobile`}>
          <div className={styles.grouped}>
            <ProfileHeader name="Maya Johnson" subtitle="+1 555-000-0002" />
            <QuickActions onAction={(l) => show(`${l} is coming soon`)} />
            <div style={{ height: 24 }} />
            <SettingsGroup>
              <SettingsRow icon="disappearing" label="Disappearing Messages" value="1 day" />
              <SettingsRow icon="chat-color" label="Chat Color & Wallpaper" />
              <SettingsRow icon="sounds" label="Sounds & Notifications" />
              <SettingsRow icon="safety-number" label="View Safety Number" />
            </SettingsGroup>
            <SettingsGroup title="3 Members">
              <SettingsRow icon="add-member" label="Add Members" chevron={false} />
              <SettingsRow avatar={<Avatar name="Julian Smith" size={38} />} label="Julian Smith" value="Admin" chevron={false} />
              <SettingsRow avatar={<Avatar name="Kai Nakamura" size={38} />} label="Kai Nakamura" chevron={false} />
            </SettingsGroup>
            <SettingsGroup footer="Read receipts let people see when you've read their messages.">
              <SettingsRow label="Read Receipts" control={<Switch checked={sw} onChange={setSw} label="Read receipts" />} />
              <SettingsRow label="Typing Indicators" control={<Switch checked={sw2} onChange={setSw2} label="Typing indicators" />} />
            </SettingsGroup>
            <SettingsGroup>
              <SettingsRow icon="leave-group" label="Leave Group" destructive />
              <SettingsRow icon="block" label="Block Group" destructive />
            </SettingsGroup>
          </div>
        </div>
      </div>

      <h2 className={styles.h}>Components</h2>
      <div className={styles.grid}>
        <Section title="Icon" wide>
          <div className={styles.icons}>
            {ICON_NAMES.map((n) => (
              <span key={n} className={styles.iconCell} title={n}>
                <Icon name={n} />
                <small>{n}</small>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Avatar">
          <Avatar name="Maya Johnson" size={48} online />
          <Avatar name="Family" kind="group" size={48} />
          <Avatar name="Note to Self" kind="note" size={48} />
          <Avatar name="Kai" size={32} />
          <Avatar name="Julian Smith" size={28} />
          <Avatar name="Paige Hall" size={96} />
        </Section>

        <Section title="Button">
          <Button>Continue</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Learn more</Button>
          <Button disabled>Disabled</Button>
          <Button variant="icon" icon="compose" aria-label="Compose" />
          <Button variant="icon" icon="more" aria-label="More" />
        </Section>

        <Section title="UnreadBadge · DeliveryStatus · Spinner">
          <UnreadBadge count={3} />
          <UnreadBadge count={128} />
          <UnreadBadge count={4} tone="alert" />
          <UnreadBadge dot />
          <span className={styles.statusRow}>
            <DeliveryStatus status="sending" /> <DeliveryStatus status="sent" /> <DeliveryStatus status="delivered" />{" "}
            <DeliveryStatus status="read" />
          </span>
          <Spinner />
          <Spinner size={16} />
        </Section>

        <Section title="SearchField · ChatListHeader">
          <div className={styles.listBox}>
            <ChatListHeader menuItems={MENU_SAMPLE} />
            <div style={{ padding: "0 12px 8px" }}>
              <SearchField placeholder="Search" />
            </div>
          </div>
        </Section>

        <Section title="ConversationRow">
          <div className={styles.listBox}>
            <ConversationRow name="Maya Johnson" time="9:41 AM" preview="Perfect, see you at 7" unread={2} online />
            <ConversationRow name="Paige Hall" time="40m" preview="Sounds good" status="read" selected />
            <ConversationRow name="Kai Nakamura" time="Wed" typing />
            <ConversationRow name="Family" kind="group" time="Tue" sender="Mom" preview="Who's bringing dessert?" muted />
          </div>
        </Section>

        <Section title="MessageBubble (group, quote, reaction, timer, deleted)" wide>
          <div className={styles.paneBox}>
            <GroupSample />
          </div>
        </Section>

        <Section title="MessageActions · ReactionPicker · ReactionChips">
          <div className={styles.stack}>
            <MessageActions onReact={(e) => show(`Reacted ${e}`)} onReply={() => show("Reply")} menuItems={MENU_SAMPLE} />
            <ReactionPicker selected="❤️" onSelect={(e) => show(`Reacted ${e}`)} onMore={() => {}} />
            <div className={styles.row}>
              <ReactionChips reactions={[{ emoji: "👍", count: 1 }]} />
              <ReactionChips reactions={[{ emoji: "❤️", count: 3, mine: true }, { emoji: "😂", count: 2 }, { emoji: "😮", count: 1 }]} />
            </div>
          </div>
        </Section>

        <Section title="Menu · DropdownMenu · ContextMenu">
          <MenuList items={MENU_SAMPLE} aria-label="Sample" />
          <div className={styles.stack}>
            <DropdownMenu items={MENU_SAMPLE} />
            <div className={styles.ctxTarget} onContextMenu={ctx.onContextMenu}>
              Right-click here
            </div>
            <ContextMenu position={ctx.position} items={MENU_SAMPLE} onClose={ctx.close} />
          </div>
        </Section>

        <Section title="SystemNotice · DateDivider · TypingIndicator">
          <div className={styles.paneBox}>
            <DateDivider label="Today" />
            <DateDivider date={new Date(2026, 9, 5)} now={new Date(2026, 9, 8)} />
            <SystemNotice icon="disappearing">Maya set disappearing message time to 1 hour.</SystemNotice>
            <SystemNotice>Julian Smith added Kai Nakamura.</SystemNotice>
            <TypingIndicator />
          </div>
        </Section>

        <Section title="QuoteBlock · Composer (desktop)">
          <div className={styles.paneBox} style={{ padding: 0 }}>
            <MessageBubble direction="outgoing" time="9:41 AM" status="read" quote={{ author: "Maya Johnson", text: "Are we still on for tonight?" }}>
              Yes!
            </MessageBubble>
            <div style={{ height: 12 }} />
            <QuoteBlock author="Maya Johnson" text="How about 7? They don't take reservations so earlier is better." onClose={() => {}} />
            <QuoteBlock author="You" text="What time works for you?" color="green" onClose={() => {}} />
            <div style={{ height: 8 }} />
            <ComposerDemo />
          </div>
        </Section>

        <Section title="EncryptionNotice · ScrollToBottom">
          <div className={styles.paneBox} style={{ position: "relative", minHeight: 260 }}>
            <EncryptionNotice name="Kai Nakamura" subtitle="+1 555-000-0004" />
            <ScrollToBottom count={5} onClick={() => {}} />
          </div>
        </Section>

        <Section title="EmptyChatPane">
          <div className={styles.paneBox} style={{ height: 320, padding: 0, display: "flex" }}>
            <EmptyChatPane />
          </div>
        </Section>

        <Section title="ComingSoon">
          <div className={styles.paneBox} style={{ height: 260 }}>
            <ComingSoon icon="stories" title="Stories are coming soon">
              Share photos and videos that disappear after 24 hours.
            </ComingSoon>
          </div>
        </Section>

        <Section title="TextField · PhoneInput · OtpInput">
          <div className={styles.form}>
            <TextField label="Your name" placeholder="First name" value={name} onChange={(e) => setName(e.target.value)} hint="Your profile is end-to-end encrypted." />
            <TextField label="Group name" defaultValue="" placeholder="Group name (required)" error="Group name is required" />
            <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChange={setPhone} />
            <OtpInput value={otp} onChange={setOtp} onComplete={(v) => show(`Code ${v} entered`)} />
            <OtpInput value="654321" onChange={() => {}} error="Incorrect code. Try again." />
          </div>
        </Section>

        <Section title="Switch · RadioGroup · Tooltip">
          <div className={styles.stack}>
            <label className={styles.row}>
              <Switch checked={sw} onChange={setSw} label="Read receipts" /> Read receipts
            </label>
            <label className={styles.row}>
              <Switch checked={sw2} onChange={setSw2} label="Typing indicators" /> Typing indicators
            </label>
            <Switch checked disabled onChange={() => {}} label="Disabled" />
            <RadioGroup label="Theme" value={theme} onChange={changeTheme} options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]} />
            <Tooltip label="New chat">
              <Button variant="icon" icon="compose" aria-label="New chat" />
            </Tooltip>
          </div>
        </Section>

        <Section title="Toast · Modal">
          <div className={styles.stack}>
            <Toast>Contact added</Toast>
            <Toast action="Undo" onAction={() => {}}>Message deleted</Toast>
            <div className={styles.row}>
              <Button variant="secondary" onClick={() => show("Copied to clipboard")}>Show toast</Button>
              <Button variant="secondary" onClick={() => show("Message deleted", { action: "Undo" })}>Toast + action</Button>
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            </div>
          </div>
          <div className={styles.modalBox}>
            <Modal
              inline
              title="Delete for everyone?"
              onClose={() => {}}
              actions={
                <>
                  <Button variant="secondary">Cancel</Button>
                  <Button variant="destructive">Delete</Button>
                </>
              }
            >
              This message will be deleted for everyone in the chat.
            </Modal>
          </div>
        </Section>

        <Section title="GetStartedCard · TabBar">
          <div className={`${styles.stack} sg-mobile`} style={{ padding: 16, background: "var(--surface-pane)" }}>
            <div className={styles.cards}>
              <GetStartedCard label="New group" image="/illustrations/get-started-new-group.svg" onDismiss={() => {}} />
              <GetStartedCard label="Invite friends" image="/illustrations/get-started-invite-friends.svg" onDismiss={false} />
            </div>
            <TabBar badges={{ chats: 4, stories: 2 }} />
          </div>
        </Section>
      </div>

      <Modal
        open={modalOpen}
        title="New group"
        onClose={() => setModalOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { setModalOpen(false); show("Group created"); }}>Create</Button>
          </>
        }
      >
        <TextField label="Group name" placeholder="Group name (required)" />
      </Modal>

      <ToastViewport toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function ComposerDemo() {
  return (
    <>
      <Composer />
      <Composer defaultValue="Typing a reply…" />
      <div className="sg-mobile">
        <Composer layout="mobile" />
      </div>
    </>
  );
}
