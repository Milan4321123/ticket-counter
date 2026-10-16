// Server-only: what is waiting for a member — unread group-chat messages on
// their meetups plus unread private messages. One number for the badge.
import type { Member } from './community';
import { unreadConversations } from './conversations';
import { unreadMeetupMessages } from './meetups';

export function communityUnread(member: Member): number {
  return unreadMeetupMessages(member) + unreadConversations(member);
}
