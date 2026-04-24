import ChatLayout from '../chat/layout'
import { ChatPageContent } from '../chat/page'

export default function DiscoverChannelsPage() {
  return (
    <ChatLayout>
      <ChatPageContent lockedView="discover-channels" hideRail />
    </ChatLayout>
  )
}
