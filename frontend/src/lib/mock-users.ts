export const MOCK_USER_AVATARS = [
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776547757/images_il5y2p.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776547580/04ecf20035482b23a0c12fca78b7bb92_jcs4m2.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1775860636/caveman2_hnhf11.png',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1765051898/avatars/user_693204d3b41b075662a84bbf.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1765061507/avatars/user_693203f2b41b075662a84b97.jpg',
] as const

const PRESET_AVATAR_BY_SEED: Record<string, string> = {
  amina: MOCK_USER_AVATARS[0],
  nora: MOCK_USER_AVATARS[4],
  omar: MOCK_USER_AVATARS[2],
  rayan: MOCK_USER_AVATARS[3],
  sara: MOCK_USER_AVATARS[1],
}

export const MOCK_USER_BANNERS = [
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776700682/43_qsvgh1.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776700682/44_aswkvy.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776700682/40_ikgzkn.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776700682/47_tksdin.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776700683/53_ubgxix.jpg',
  'https://res.cloudinary.com/dectxiuco/image/upload/v1776700683/64_u7mibm.jpg',
] as const

function getSeedIndex(seed: string, length: number) {
  return seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0) % length
}

function normalizeSeed(seed: string) {
  return seed.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getMockUserAvatar(seed: string) {
  const normalized = normalizeSeed(seed)
  const preset = PRESET_AVATAR_BY_SEED[normalized]
  if (preset) return preset
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(normalized || 'user')}`
}

export function getMockUserBanner(seed: string) {
  return MOCK_USER_BANNERS[getSeedIndex(seed, MOCK_USER_BANNERS.length)]
}
