'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { PixelRoomGroupView } from './pixel-room-group-view'
import { usePixelPresence, type ActivePixelRoom } from '@/context/PixelPresenceContext'
import { useChannels } from '@/hooks/use-channels'
import { useProfile } from '@/hooks/use-user'
import { ShareModal } from '@/components/chat/share-modal'
import type { MockChannelGroup } from '@/components/chat/channels-panel'

interface Props {
  activeRoom: ActivePixelRoom
  isHidden: boolean
}

export function PersistentPixelRoom({ activeRoom, isHidden }: Props) {
  const { data: profile } = useProfile()
  const { data: channels = [] } = useChannels()
  const { leaveRoom, mountTarget } = usePixelPresence()
  const [shareOpen, setShareOpen] = useState(false)
  const [parkEl, setParkEl] = useState<HTMLDivElement | null>(null)

  const channel = channels.find(c => c.id === activeRoom.channelId)
  const isChannelAdmin = !!profile && !!channel && (
    channel.role === 'OWNER' || channel.role === 'ADMIN' || channel.owner_id === profile.id
  )

  const group: MockChannelGroup = useMemo(() => ({
    id: activeRoom.groupId,
    label: activeRoom.groupName,
    description: '',
    kind: 'pixel-room',
    access_type: 'PUBLIC',
    is_general: false,
    is_member: true,
    membersLabel: '',
    pinnedBy: '',
    pinnedMessage: '',
  }), [activeRoom])

  const target = !isHidden && mountTarget ? mountTarget : parkEl

  return (
    <>
      <div
        ref={setParkEl}
        aria-hidden
        className="pointer-events-none invisible fixed left-0 top-0 h-px w-px overflow-hidden"
      />
      {target && createPortal(
        <PixelRoomGroupView
          group={group}
          channelId={activeRoom.channelId}
          myId={profile?.id}
          isChannelAdmin={isChannelAdmin}
          isHidden={isHidden}
          onLeave={() => leaveRoom()}
          onShare={() => setShareOpen(true)}
        />,
        target,
      )}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        payload={{
          content: JSON.stringify({
            __twiky_type: 'pixel_room_invite',
            groupId: activeRoom.groupId,
            groupName: activeRoom.groupName,
            channelId: activeRoom.channelId,
            inviterName: profile?.username || 'Someone',
          }),
        }}
        title={`Share ${activeRoom.groupName}`}
      />
    </>
  )
}
