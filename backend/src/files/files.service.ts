import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import {
  IMAGE_MIME_TYPES,
  MAX_GROUP_FILE_BYTES,
  MAX_IMAGE_BYTES,
  STORAGE_BUCKETS,
} from './storage.constants';

type ImageSlot = 'banner' | 'logo';
type UserImageSlot = 'avatar_url' | 'logo';

@Injectable()
export class FilesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private assertImage(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`Image too large (max ${MAX_IMAGE_BYTES} bytes)`);
    }
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
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
    cacheControl = '3600',
  ): Promise<{ path: string; publicUrl: string }> {
    const client = this.supabaseService.getClient();
    const { error } = await client.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
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
    this.assertImage(file);
    const ext = this.extFromMime(file.mimetype);
    const objectPath = `${channelId}/${slot}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.channel, objectPath, file);
  }

  async uploadUserImage(userId: string, slot: UserImageSlot, file: Express.Multer.File) {
    this.assertImage(file);
    const ext = this.extFromMime(file.mimetype);
    const objectPath = `${userId}/${slot}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.users, objectPath, file);
  }

  async uploadGroupImage(userId: string, groupId: string, slot: ImageSlot, file: Express.Multer.File) {
    await this.assertGroupUploader(userId, groupId);
    this.assertImage(file);
    const ext = this.extFromMime(file.mimetype);
    const objectPath = `${groupId}/${slot}${ext}`;
    return this.uploadObject(STORAGE_BUCKETS.groups, objectPath, file);
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
