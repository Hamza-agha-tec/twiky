export type PixelAssetKind = 'avatar' | 'object'
export type PixelDirection = 'down' | 'left' | 'up' | 'right'

export type PixelCatalogItem = {
  id: string
  kind: PixelAssetKind
  name: string
  category: string
  src: string
  width: number
  height: number
  price: number
  defaultUnlocked: boolean
  canSit?: boolean
  seatDirection?: PixelDirection
}

export type PlacedRoomObject = {
  id: string
  itemId: string
  x: number
  y: number
  rotation: 0 | 1 | 2 | 3
}

export type PixelRoomState = {
  avatarId: string
  avatarX: number
  avatarY: number
  avatarDirection: PixelDirection
  isSitting: boolean
  sittingObjectId: string | null
  objects: PlacedRoomObject[]
  ownedItemIds: string[]
}

export const ROOM_COLUMNS = 26
export const ROOM_ROWS = 18
export const TILE_WIDTH = 32
export const TILE_HEIGHT = 32

export const DEFAULT_AVATAR_ID = 'default-avatar'

export const AVATAR_CATALOG: PixelCatalogItem[] = [
  {
    id: DEFAULT_AVATAR_ID,
    kind: 'avatar',
    name: 'Default Explorer',
    category: 'Default',
    src: '/pixel/game/avatars/default_avatar.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
]

export const OBJECT_CATALOG: PixelCatalogItem[] = [
  {
    id: 'office-chair',
    kind: 'object',
    name: 'Office Chair',
    category: 'Seating',
    src: '/pixel/game/objects/chair_office_rolling_white_down.png',
    width: 32,
    height: 38,
    price: 0,
    defaultUnlocked: true,
    canSit: true,
    seatDirection: 'down',
  },
  {
    id: 'plant-skinny-white',
    kind: 'object',
    name: 'Potted Plant',
    category: 'Decor',
    src: '/pixel/game/objects/plant_potted_skinny_white.png',
    width: 32,
    height: 64,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'desktop-set-white',
    kind: 'object',
    name: 'Desk Setup',
    category: 'Work',
    src: '/pixel/game/objects/desktop_set_white_down.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'couch-purple',
    kind: 'object',
    name: 'Purple Couch',
    category: 'Lounge',
    src: '/pixel/game/objects/couch_purple_down.png',
    width: 128,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'round-table-wood',
    kind: 'object',
    name: 'Round Table',
    category: 'Furniture',
    src: '/pixel/game/objects/table_simpleround_wood.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'bookshelf-bright',
    kind: 'object',
    name: 'Bookshelf',
    category: 'Storage',
    src: '/pixel/game/objects/bookshelf_darkwood_bright_2x2.png',
    width: 64,
    height: 64,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'desk-lamp',
    kind: 'object',
    name: 'Desk Lamp',
    category: 'Decor',
    src: '/pixel/game/objects/lamp_desk_down.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'pastel-rug',
    kind: 'object',
    name: 'Pastel Rug',
    category: 'Floor',
    src: '/pixel/game/objects/rug_needlepoint_pastelblue.png',
    width: 128,
    height: 128,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'coffee-mug',
    kind: 'object',
    name: 'Coffee Mug',
    category: 'Desk',
    src: '/pixel/game/objects/coffee_mug_white.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'monitor-up',
    kind: 'object',
    name: 'Monitor',
    category: 'Work',
    src: '/pixel/game/objects/monitor_up.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
  {
    id: 'backpack-blue',
    kind: 'object',
    name: 'Blue Backpack',
    category: 'Personal',
    src: '/pixel/game/objects/backpack_blue.png',
    width: 32,
    height: 32,
    price: 0,
    defaultUnlocked: true,
  },
]

export const PIXEL_CATALOG = [...AVATAR_CATALOG, ...OBJECT_CATALOG]

export function createDefaultRoomState(): PixelRoomState {
  return {
    avatarId: DEFAULT_AVATAR_ID,
    avatarX: Math.floor(ROOM_COLUMNS / 2),
    avatarY: Math.floor(ROOM_ROWS / 2),
    avatarDirection: 'down',
    isSitting: false,
    sittingObjectId: null,
    objects: [],
    ownedItemIds: PIXEL_CATALOG.filter((item) => item.defaultUnlocked).map((item) => item.id),
  }
}
