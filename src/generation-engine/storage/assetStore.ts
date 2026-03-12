// Asset Store - R2 storage operations for generated assets

import { generateUUID } from '../../utils/storage';

export interface AssetMetadata {
  key: string;
  url: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export interface AssetStoreOptions {
  imagesBucket: any;
  videoBucket: any;
  audioBucket: any;
}

export class AssetStore {
  private imagesBucket: any;
  private videoBucket: any;
  private audioBucket: any;

  constructor(options: AssetStoreOptions) {
    this.imagesBucket = options.imagesBucket;
    this.videoBucket = options.videoBucket;
    this.audioBucket = options.audioBucket;
  }

  async uploadImage(
    data: ArrayBuffer,
    options: {
      userId: string;
      seriesId?: string;
      storyId: string;
      sceneIndex?: number;
      contentType?: string;
    }
  ): Promise<AssetMetadata> {
    const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } = await import('../../config/table-config');
    
    const folderName = SHORT_STORIES_FOLDER_NAMES.FACELess;
    const pathParts = [FOLDER_NAMES.SHORT_STORIES, folderName, options.userId];
    if (options.seriesId) {
      pathParts.push(options.seriesId);
    }
    pathParts.push(options.storyId);
    const pathName = pathParts.join('/');

    const ext = this.getExtensionFromContentType(options.contentType || 'image/jpeg');
    const fileName = `${options.sceneIndex !== undefined ? `scene-${options.sceneIndex}-` : ''}${generateUUID()}.${ext}`;
    const key = `${pathName}/${fileName}`;

    const contentType = options.contentType || 'image/jpeg';

    await this.imagesBucket.put(key, data, {
      httpMetadata: { contentType },
    });

    const url = `https://image.artflicks.app/${key}`;

    return {
      key,
      url,
      contentType,
      size: data.byteLength,
      createdAt: new Date().toISOString(),
    };
  }

  async uploadVideo(
    data: ArrayBuffer,
    options: {
      userId: string;
      seriesId?: string;
      storyId: string;
      sceneIndex?: number;
    }
  ): Promise<AssetMetadata> {
    const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } = await import('../../config/table-config');
    
    const folderName = SHORT_STORIES_FOLDER_NAMES.FACELess;
    const pathParts = [FOLDER_NAMES.SHORT_STORIES, folderName, options.userId];
    if (options.seriesId) {
      pathParts.push(options.seriesId);
    }
    pathParts.push(options.storyId);
    const pathName = pathParts.join('/');

    const fileName = `${options.sceneIndex !== undefined ? `scene-${options.sceneIndex}-` : ''}${generateUUID()}.mp4`;
    const key = `${pathName}/${fileName}`;

    await this.videoBucket.put(key, data, {
      httpMetadata: { contentType: 'video/mp4' },
    });

    const url = `https://videos.artflicks.app/${key}`;

    return {
      key,
      url,
      contentType: 'video/mp4',
      size: data.byteLength,
      createdAt: new Date().toISOString(),
    };
  }

  async uploadAudio(
    data: ArrayBuffer,
    options: {
      userId: string;
      sceneNumber: number;
      narration?: string;
    }
  ): Promise<AssetMetadata> {
    const { FOLDER_NAMES, audio_output_format } = await import('../../config/table-config');
    
    const cleanNarration = (options.narration || '')
      .split(' ')
      .slice(0, 2)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    const fileName = `${cleanNarration}-${options.sceneNumber}-${generateUUID()}.${audio_output_format}`;
    const key = `${FOLDER_NAMES.VOICE_OVERS}/${options.userId}/${fileName}`;

    await this.audioBucket.put(key, data, {
      httpMetadata: { contentType: 'audio/mpeg' },
    });

    const url = `https://audio.artflicks.app/${key}`;

    return {
      key,
      url,
      contentType: 'audio/mpeg',
      size: data.byteLength,
      createdAt: new Date().toISOString(),
    };
  }

  async getAsset(key: string, type: 'image' | 'video' | 'audio'): Promise<ArrayBuffer | null> {
    const bucket = type === 'image' ? this.imagesBucket : 
                   type === 'video' ? this.videoBucket : 
                   this.audioBucket;
    
    const asset = await bucket.get(key);
    if (!asset) return null;
    
    return asset.arrayBuffer();
  }

  async deleteAsset(key: string, type: 'image' | 'video' | 'audio'): Promise<boolean> {
    const bucket = type === 'image' ? this.imagesBucket : 
                   type === 'video' ? this.videoBucket : 
                   this.audioBucket;
    
    try {
      await bucket.delete(key);
      return true;
    } catch {
      return false;
    }
  }

  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
    };
    return map[contentType] || 'bin';
  }
}

export function createAssetStore(options: AssetStoreOptions): AssetStore {
  return new AssetStore(options);
}
