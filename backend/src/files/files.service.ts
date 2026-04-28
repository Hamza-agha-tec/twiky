import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import {
  AUDIO_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_BANNER_BYTES,
  MAX_ENTER_SOUND_BYTES,
  MAX_GROUP_FILE_BYTES,
  MAX_IMAGE_BYTES,
  STORAGE_BUCKETS,
} from './storage.constants';

type ImageSlot = 'banner' | 'logo';
type UserImageSlot = 'avatar_url' | 'logo';

@Injectable()
export class FilesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private inferImageMimeType(file: Express.Multer.File): string | null {
    const claimedMime = file.mimetype?.toLowerCase().trim()
    if (claimedMime && IMAGE_MIME_TYPES.has(claimedMime)) {
      return claimedMime
    }

    const lowerName = file.originalname?.toLowerCase().trim() ?? ''
    if (lowerName.endsWith('.gif')) return 'image/gif'
    if (lowerName.endsWith('.png')) return 'image/png'
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
    if (lowerName.endsWith('.webp')) return 'image/webp'
    if (lowerName.endsWith('.svg')) return 'image/svg+xml'

    const buffer = file.buffer
    if (!buffer?.length) return null

    const startsWith = (signature: number[]) =>
      signature.every((value, index) => buffer[index] === value)

    if (startsWith([0x47, 0x49, 0x46, 0x38])) return 'image/gif'
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
    if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg'
    if (
      startsWith([0x52, 0x49, 0x46, 0x46]) &&
      buffer.length >= 12 &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp'
    }

    const textStart = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trimStart()
    if (textStart.startsWith('<svg') || textStart.startsWith('<?xml')) {
      return 'image/svg+xml'
    }

    return null
  }

  private assertImage(file: Express.Multer.File, resolvedMimeType?: string | null) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`Image too large (max ${MAX_IMAGE_BYTES} bytes)`);
    }
    if (!resolvedMimeType || !IMAGE_MIME_TYPES.has(resolvedMimeType)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }
  }

  private assertBannerImage(file: Express.Multer.File, resolvedMimeType?: string | null) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file');
    }
    if (file.size > MAX_BANNER_BYTES) {
      throw new BadRequestException(`Banner image too large (max ${MAX_BANNER_BYTES} bytes)`);
    }
    if (!resolvedMimeType || !IMAGE_MIME_TYPES.has(resolvedMimeType)) {
      throw new BadRequestException(`Unsupported banner image type: ${file.mimetype}`);
    }
  }

  private assertGroupFile(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file');
    }
    if (file.size > MAX_GROUP_FILE_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_GROUP_FILE_BYTES} bytes)`);
    }
  }

  private async assertChannelAdminOrOwner(userId: string, channelId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new ForbiddenException('Not a member of this channel');
    if (data.role !== 'OWNER' && data.role !== 'ADMIN') {
      throw new ForbiddenException('Only channel owners or admins can change channel media');
    }
  }

  private async assertGroupUploader(userId: string, groupId: string) {
    const { data: group, error: gErr } = await this.supabaseService
      .getClient()
      .from('groups')
      .select('channel_id')
      .eq('id', groupId)
      .maybeSingle();

    if (gErr) throw new BadRequestException(gErr.message);
    if (!group) throw new NotFoundException('Group not found');

    const { data: gm } = await this.supabaseService
      .getClient()
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (gm) return;

    const { data: cm } = await this.supabaseService
      .getClient()
      .from('channel_members')
      .select('role')
      .eq('channel_id', group.channel_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (cm && (cm.role === 'OWNER' || cm.role === 'ADMIN')) return;

    throw new ForbiddenException('Not allowed to upload to this group');
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? '';
  }

  private async uploadObject(
    bucket: string,
    objectPath: string,
    file: Express.Multer.File,
    contentType = file.mimetype,
    cacheControl = '3600',
  ): Promise<{ path: string; publicUrl: string }> {
    const client = this.supabaseService.getClient();
    const { error } = await client.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType,
      upsert: true,
      cacheControl,
    });

    if (error) {
      throw new BadRequestException(`Storage upload failed: ${error.message}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    return { path: objectPath, publicUrl: data.publicUrl };
  }

  async uploadChannelImage(
    userId: string,
    channelId: string,
    slot: ImageSlot,
    file: Express.Multer.File,
  ) {
    await this.assertChannelAdminOrOwner(userId, channelId);
    const resolvedMimeType = this.inferImageMimeType(file);
    if (slot === 'banner') {
      this.assertBannerImage(file, resolvedMimeType);
    } else {
      this.assertImage(file, resolvedMimeType);
    }
    const ext = this.extFromMime(resolvedMimeType ?? file.mimetype);
    const objectPath = `${channelId}/${slot}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.channel, objectPath, file, resolvedMimeType ?? file.mimetype);
  }

  async uploadUserImage(userId: string, slot: UserImageSlot, file: Express.Multer.File) {
    const resolvedMimeType = this.inferImageMimeType(file);
    if (slot === 'logo') {
      this.assertBannerImage(file, resolvedMimeType);
    } else {
      this.assertImage(file, resolvedMimeType);
    }
    const ext = this.extFromMime(resolvedMimeType ?? file.mimetype);
    const objectPath = `${userId}/${slot}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.users, objectPath, file, resolvedMimeType ?? file.mimetype);
  }

  async uploadGroupImage(userId: string, groupId: string, slot: ImageSlot, file: Express.Multer.File) {
    await this.assertGroupUploader(userId, groupId);
    const resolvedMimeType = this.inferImageMimeType(file);
    if (slot === 'banner') {
      this.assertBannerImage(file, resolvedMimeType);
    } else {
      this.assertImage(file, resolvedMimeType);
    }
    const ext = this.extFromMime(resolvedMimeType ?? file.mimetype);
    const objectPath = `${groupId}/${slot}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.groups, objectPath, file, resolvedMimeType ?? file.mimetype);
  }

  /** Single “file” slot under the group folder (diagram); good for one primary attachment. */
  async uploadGroupPrimaryFile(userId: string, groupId: string, file: Express.Multer.File) {
    await this.assertGroupUploader(userId, groupId);
    this.assertGroupFile(file);
    const ext = this.extFromMime(file.mimetype) || '.bin';
    const objectPath = `${groupId}/file${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.groups, objectPath, file);
  }

  /**
   * Extra objects under `{groupId}/...` (diagram “…”).
   * Stored as `{groupId}/files/{timestamp}_{safeOriginalName}`.
   */
  async uploadMessageFile(userId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Missing file');
    if (file.size > MAX_GROUP_FILE_BYTES) throw new BadRequestException('File too large (max 25 MiB)');

    const isImage = IMAGE_MIME_TYPES.has(file.mimetype?.toLowerCase()) ||
      this.inferImageMimeType(file) !== null;
    const resolvedMime = isImage ? (this.inferImageMimeType(file) ?? file.mimetype) : file.mimetype;
    const fileType = isImage ? 'image' : 'file';
    const rawName = (file.originalname || 'upload').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const ext = this.extFromMime(resolvedMime) || (rawName.match(/\.[a-z0-9]+$/i)?.[0] ?? '.bin');
    const objectPath = `${userId}/${Date.now()}_${rawName.replace(/\.[^.]+$/, '')}${ext}`;
    const { publicUrl } = await this.uploadObject(STORAGE_BUCKETS.messages, objectPath, file, resolvedMime);
    return { fileName: file.originalname, fileUrl: publicUrl, fileType };
  }

  async uploadUserEnterSound(userId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Missing file');
    if (file.size > MAX_ENTER_SOUND_BYTES) throw new BadRequestException('Enter sound too large (max 10 MiB / ~1 min)');
    const mime = file.mimetype?.toLowerCase().trim();
    const ext = file.originalname?.toLowerCase();
    const isAudio = AUDIO_MIME_TYPES.has(mime) ||
      ext?.endsWith('.mp3') || ext?.endsWith('.ogg') || ext?.endsWith('.wav') ||
      ext?.endsWith('.aac') || ext?.endsWith('.m4a') || ext?.endsWith('.webm') || ext?.endsWith('.flac');
    if (!isAudio) throw new BadRequestException('File must be an audio file (mp3, ogg, wav, aac, m4a, webm, flac)');
    const extMap: Record<string, string> = {
      'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg',
      'audio/wav': '.wav', 'audio/wave': '.wav', 'audio/x-wav': '.wav',
      'audio/aac': '.aac', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a',
      'audio/webm': '.webm', 'audio/flac': '.flac',
    };
    const resolvedExt = extMap[mime] ?? (file.originalname?.match(/\.[a-z0-9]+$/i)?.[0] ?? '.mp3');
    const objectPath = `enter-sounds/${userId}/enter_sound${resolvedExt}`;
    return this.uploadObject(STORAGE_BUCKETS.messages, objectPath, file, mime || 'audio/mpeg');
  }

  async uploadGroupExtra(userId: string, groupId: string, file: Express.Multer.File) {
    await this.assertGroupUploader(userId, groupId);
    this.assertGroupFile(file);
    const rawName = (file.originalname || 'upload').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const extFromMime = this.extFromMime(file.mimetype);
    const nameHasExt = /\.[a-z0-9]+$/i.test(rawName);
    const extFromName = nameHasExt ? (rawName.match(/\.[a-z0-9]+$/i)?.[0] ?? '') : '';
    const ext = extFromMime || extFromName || '.bin';
    const base = (nameHasExt ? rawName.replace(/\.[^.]+$/, '') : rawName) || 'file';
    const objectPath = `${groupId}/files/${Date.now()}_${base}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.groups, objectPath, file);
  }
}
