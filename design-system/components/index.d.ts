// SignalUI — types as documentation
import type { ReactNode } from 'react';

export type FigmaIcon = 'camera'|'camera-composer'|'compose'|'search'|'search-action'|'back'|'chevron-right'|'plus'|'sticker'|'mic'|'send'|'phone'|'video'|'video-header'|'muted'|'disappearing'|'chat-color'|'sounds'|'contact'|'safety-number'|'verified'|'add-member'|'requests'|'permissions'|'block'|'dismiss'|'tab-chats'|'tab-stories';
export type LineIcon = 'menu'|'more'|'settings'|'stories'|'smile'|'note'|'lock'|'close'|'timer'|'leave-group';
export type IconName = FigmaIcon | LineIcon | 'chat'|'attach'|'emoji'|'video-call'|'voice-call';
export interface IconProps { name: IconName; size?: number; strokeWidth?: number; label?: string; className?: string }
export interface AvatarProps { name: string; src?: string; size?: number; kind?: 'note'|'group'; online?: boolean }
export interface ButtonProps { variant?: 'primary'|'secondary'|'destructive'|'link'|'icon'; icon?: IconName; 'aria-label'?: string; disabled?: boolean; onClick?: () => void; children?: ReactNode }
export interface UnreadBadgeProps { count?: number; tone?: 'unread'|'alert'; dot?: boolean }
export type MessageStatus = 'sending'|'sent'|'delivered'|'read';
export interface DeliveryStatusProps { status: MessageStatus }
export interface SearchFieldProps { placeholder?: string; value?: string; defaultValue?: string; onChange?: (e: any) => void }
export interface ConversationRowProps { name: string; time: string; preview?: ReactNode; sender?: string; unread?: number; status?: MessageStatus; selected?: boolean; typing?: boolean; online?: boolean; avatarSrc?: string; avatarSize?: number; kind?: 'note'|'group'; onClick?: () => void }
export interface NavRailProps { active?: 'chats'|'calls'|'stories'; badges?: { chats?: number; calls?: number; stories?: number }; selfName?: string; selfAvatar?: string; onSelect?: (id: string) => void }
export interface TabBarProps { active?: string; badges?: Record<string, number>; tabs?: [id: string, icon: IconName, label: string][]; onSelect?: (id: string) => void }
export interface ChatHeaderProps { name: string; subtitle?: string; timer?: boolean; verified?: boolean; isGroup?: boolean; compact?: boolean; avatarSrc?: string; avatarSize?: number; kind?: 'note'|'group'; onBack?: () => void }
export type SenderColor = 'green'|'indigo'|'crimson'|'teal'|'orange';
export interface MessageBubbleProps { direction: 'incoming'|'outgoing'; time: string; status?: MessageStatus; position?: 'single'|'first'|'middle'|'last'; expires?: boolean; sender?: string; senderColor?: SenderColor; senderAvatar?: string; quote?: { author: string; text: string }; reaction?: string; chatColor?: string; children: ReactNode }
export interface SystemNoticeProps { icon?: IconName; children: ReactNode }
export interface TypingIndicatorProps { inline?: boolean }
export interface ComposerProps { layout?: 'desktop'|'mobile'; placeholder?: string; defaultValue?: string; onSend?: (text: string) => void; onTyping?: () => void }
export interface ProfileHeaderProps { name: string; subtitle?: string; avatarSrc?: string; kind?: 'note'|'group'; size?: number }
export interface QuickActionsProps { items?: [icon: IconName, label: string][]; onAction?: (label: string) => void }
export interface SettingsGroupProps { title?: string; footer?: string; children: ReactNode }
export interface SettingsRowProps { label: string; sublabel?: string; value?: ReactNode; icon?: IconName; avatar?: ReactNode; destructive?: boolean; chevron?: boolean; onClick?: () => void }
export interface GetStartedCardProps { label: string; image?: string; onClick?: () => void; onDismiss?: (() => void) | false }
export interface ToastProps { action?: string; onAction?: () => void; children: ReactNode }
export interface ModalProps { title: string; open?: boolean; inline?: boolean; onClose?: () => void; actions?: ReactNode; children?: ReactNode }
export interface ComingSoonProps { icon?: IconName; title?: string; children?: ReactNode }
