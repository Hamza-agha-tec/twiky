import ChatLayout from '../chat/layout'
import { ChatPageContent } from '../chat/page'

export default function NotificationsPage() {
  return (
    <ChatLayout>
      <ChatPageContent lockedView="notifications" hideRail />
    </ChatLayout>
  )
}
