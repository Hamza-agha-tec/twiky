'use client'

import { Gamepad2, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

interface ProfileRoomFrameProps {
  owner: string
}

export function ProfileRoomFrame({ owner }: ProfileRoomFrameProps) {
  const initials = owner
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'YR'

  return (
    <div className="space-y-3">
      <div className="rounded-none bg-[#050814] p-[6px] shadow-[0_0_0_2px_#0f172a,0_0_0_6px_#1e293b,0_0_0_8px_#7dd3fc]">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#0c1322] [image-rendering:pixelated]">
          <div className="absolute inset-x-0 top-0 h-[58%] bg-[linear-gradient(180deg,#16304f_0%,#284a73_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[repeating-linear-gradient(90deg,#23384a_0_18px,#294255_18px_36px)]" />
          <div className="absolute left-[11%] top-[16%] h-[22%] w-[18%] bg-[#314b79]" />
          <div className="absolute left-[15%] top-[20%] h-[14%] w-[10%] bg-[#9fe8ff]" />
          <div className="absolute left-[38%] top-[14%] h-[18%] w-[14%] bg-[#f2b84b]" />
          <div className="absolute left-[41%] top-[17%] h-[8%] w-[8%] bg-[#fff3c1]" />
          <div className="absolute right-[13%] top-[18%] h-[26%] w-[18%] bg-[#262f45]" />
          <div className="absolute right-[16%] top-[22%] h-[8%] w-[12%] bg-[#ffd369]" />
          <div className="absolute left-[16%] bottom-[18%] h-[17%] w-[34%] bg-[#4d6fba]" />
          <div className="absolute left-[20%] bottom-[14%] h-[4%] w-[24%] bg-[#9be4ff]" />
          <div className="absolute left-[54%] bottom-[22%] h-[16%] w-[8%] bg-[#1a2234]" />
          <div className="absolute left-[50%] bottom-[17%] h-[5%] w-[16%] bg-[#20c997]" />
          <div className="absolute right-[18%] bottom-[18%] h-[18%] w-[20%] bg-[#3a4154]" />
          <div className="absolute right-[20%] bottom-[26%] h-[8%] w-[12%] bg-[#0f172a]" />
          <div className="absolute right-[18%] bottom-[35%] h-[4%] w-[16%] bg-[#4fd1a0]" />
          <div className="absolute right-[10%] bottom-[14%] h-[8%] w-[6%] bg-[#f97316]" />
          <div className="absolute right-[12%] bottom-[10%] h-[4%] w-[10%] bg-[#fde68a]" />

          {[
            'left-[8%] top-[10%]',
            'left-[30%] top-[8%]',
            'left-[72%] top-[12%]',
            'left-[82%] top-[24%]',
          ].map((position) => (
            <div key={position} className={`absolute ${position} h-1.5 w-1.5 bg-[#dbeafe]`} />
          ))}

          <div className="absolute left-[8%] top-[8%] bg-[#09101b]/85 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#dbeafe]">
            Room Frame
          </div>
          <div className="absolute right-[8%] bottom-[8%] bg-[#09101b]/85 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#dbeafe]">
            {initials} Room
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="rounded-none px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]">
          <Gamepad2 className="mr-1 h-3.5 w-3.5" />
          Pixel Room
        </Badge>
        <Badge variant="secondary" className="rounded-none px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]">
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Future Game Mode
        </Badge>
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">
        Every profile already reserves a pixel room frame. The live room, visitors, and interaction layer can plug into this shell later.
      </p>
    </div>
  )
}
