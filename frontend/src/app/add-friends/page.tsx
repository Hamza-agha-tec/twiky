import ChatLayout from '../chat/layout'
import { ChatPageContent } from '../chat/page'

export default function AddFriendsPage() {
  return (
    <ChatLayout>
      <ChatPageContent lockedView="add-friends" hideRail />
    </ChatLayout>
  )
}
