import ChatLayout from '../chat/layout'
import { ChatPageContent } from '../chat/page'

export default function GamePage() {
  return (
    <ChatLayout>
      <ChatPageContent lockedView="game" hideRail />
    </ChatLayout>
  )
}
