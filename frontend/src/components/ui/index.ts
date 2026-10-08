// Signal UI component library. Presentational only: props in, callbacks out.
export { Icon, ICON_NAMES, type IconName, type IconProps, type LineIconName } from "./Icon/Icon";
export type { FigmaIconName } from "./Icon/figmaIcons";
export { Avatar, initials, type AvatarProps } from "./Avatar/Avatar";
export { Button, type ButtonProps } from "./Button/Button";
export { UnreadBadge, type UnreadBadgeProps } from "./UnreadBadge/UnreadBadge";
export { DeliveryStatus, type DeliveryStatusProps, type MessageStatus } from "./DeliveryStatus/DeliveryStatus";
export { SearchField, type SearchFieldProps } from "./SearchField/SearchField";
export { ConversationRow, type ConversationRowProps } from "./ConversationRow/ConversationRow";
export { NavRail, type NavRailProps, type NavRailId } from "./NavRail/NavRail";
export { TabBar, type TabBarProps, type TabBarTab } from "./TabBar/TabBar";
export { ChatHeader, type ChatHeaderProps } from "./ChatHeader/ChatHeader";
export {
  MessageBubble,
  type MessageBubbleProps,
  type SenderColor,
  type BubblePosition,
} from "./MessageBubble/MessageBubble";
export { SystemNotice, type SystemNoticeProps } from "./SystemNotice/SystemNotice";
export { TypingIndicator, type TypingIndicatorProps } from "./TypingIndicator/TypingIndicator";
export { Composer, type ComposerProps } from "./Composer/Composer";
export { ProfileHeader, type ProfileHeaderProps } from "./ProfileHeader/ProfileHeader";
export { QuickActions, type QuickActionsProps, type QuickAction } from "./QuickActions/QuickActions";
export { SettingsGroup, type SettingsGroupProps } from "./SettingsGroup/SettingsGroup";
export { SettingsRow, type SettingsRowProps } from "./SettingsRow/SettingsRow";
export { GetStartedCard, type GetStartedCardProps } from "./GetStartedCard/GetStartedCard";
export { Toast, type ToastProps } from "./Toast/Toast";
export { Modal, type ModalProps } from "./Modal/Modal";
export { ComingSoon, type ComingSoonProps } from "./ComingSoon/ComingSoon";

// Additions beyond the design system
export { TextField, type TextFieldProps } from "./TextField/TextField";
export { PhoneInput, COUNTRIES, toE164, type PhoneInputProps, type Country } from "./PhoneInput/PhoneInput";
export { OtpInput, type OtpInputProps } from "./OtpInput/OtpInput";
export { Switch, type SwitchProps } from "./Switch/Switch";
export { RadioGroup, type RadioGroupProps, type RadioOption } from "./RadioGroup/RadioGroup";
export { Popover, useIsClient, type PopoverProps, type PopoverAnchor, type PopoverPlacement } from "./Popover/Popover";
export {
  MenuList,
  DropdownMenu,
  ContextMenu,
  useContextMenu,
  type MenuItem,
  type MenuEntry,
  type DropdownMenuProps,
  type ContextMenuProps,
} from "./Menu/Menu";
export { MessageActions, type MessageActionsProps } from "./MessageActions/MessageActions";
export { ReactionPicker, DEFAULT_REACTIONS, type ReactionPickerProps } from "./ReactionPicker/ReactionPicker";
export { ReactionChips, type ReactionChipsProps, type ReactionSummary } from "./ReactionChips/ReactionChips";
export { QuoteBlock, type QuoteBlockProps } from "./QuoteBlock/QuoteBlock";
export { DateDivider, formatDayLabel, type DateDividerProps } from "./DateDivider/DateDivider";
export { ScrollToBottom, type ScrollToBottomProps } from "./ScrollToBottom/ScrollToBottom";
export { EmptyChatPane, type EmptyChatPaneProps } from "./EmptyChatPane/EmptyChatPane";
export { EncryptionNotice, type EncryptionNoticeProps } from "./EncryptionNotice/EncryptionNotice";
export { Spinner, type SpinnerProps } from "./Spinner/Spinner";
export { Tooltip, type TooltipProps } from "./Tooltip/Tooltip";
export { ToastViewport, useToast, type ToastViewportProps, type ToastMessage } from "./ToastViewport/ToastViewport";
export { ChatListHeader, type ChatListHeaderProps } from "./ChatListHeader/ChatListHeader";
export { AppShell, useIsPhone, PHONE_QUERY, type AppShellProps } from "./AppShell/AppShell";
export {
  THEME_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_EVENT,
  type ThemePreference,
} from "./theme";
export { useThemePreference } from "./useThemePreference";
