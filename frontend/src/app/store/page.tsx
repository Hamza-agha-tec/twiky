import ChatLayout from '../chat/layout'
import { ChatPageContent } from '../chat/page'

export default function StorePage() {
  return (
    <ChatLayout>
      <ChatPageContent lockedView="store" hideRail />
    </ChatLayout>
  )
}
