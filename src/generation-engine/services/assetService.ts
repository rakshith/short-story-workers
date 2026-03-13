// Asset Service - R2 storage operations

import { generateUUID } from '../../utils/storage';

export interface AssetUploadResult {
  url: string;
  key: string;
}

export class AssetService {
  constructor(
    private imagesBucket: any,
    private videoBucket: any,
    private audioBucket: any
  ) {}

  async uploadImage(
    data: ArrayBuffer,
    options: {
      userId: string;
      seriesId?: string;
      storyId: string;
      outputFormat?: string;
    }
  ): Promise<AssetUploadResult> {
    const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES, video_output_format } = await import('../../config/table-config');
    
    const folderName = SHORT_STORIES_FOLDER_NAMES.FACELess;
    const pathName = options.seriesId
      ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${options.userId}/${options.seriesId}/${options.storyId}`
      : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${options.userId}/${options.storyId}`;

    const fileName = `${generateUUID()}.${options.outputFormat || 'jpg'}`;
    const key = `${pathName}/${fileName}`;

    const contentType = options.outputFormat === video_output_format 
      ? 'video/mp4' 
      : `image/${options.outputFormat || 'jpg'}`;

    await this.imagesBucket.put(key, data, {
      httpMetadata: { contentType },
    });

    const url = `https://image.artflicks.app/${key}`;
    return { url, key };
  }

  async uploadVideo(
    data: ArrayBuffer,
    options: {
      userId: string;
      seriesId?: string;
      storyId: string;
    }
  ): Promise<AssetUploadResult> {
    const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } = await import('../../config/table-config');
    
    const folderName = SHORT_STORIES_FOLDER_NAMES.FACELess;
    const pathName = options.seriesId
      ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${options.userId}/${options.seriesId}/${options.storyId}`
      : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${options.userId}/${options.storyId}`;

    const fileName = `${generateUUID()}.mp4`;
    const key = `${pathName}/${fileName}`;

    await this.videoBucket.put(key, data, {
      httpMetadata: { contentType: 'video/mp4' },
    });

    const url = `https://videos.artflicks.app/${key}`;
    return { url, key };
  }

  async uploadAudio(
    data: ArrayBuffer,
    options: {
      userId: string;
      sceneNumber: number;
      narration?: string;
    }
  ): Promise<AssetUploadResult> {
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
    return { url, key };
  }
}

function createAssetService(
  imagesBucket: any,
  videoBucket: any,
  audioBucket: any
): AssetService {
  return new AssetService(imagesBucket, videoBucket, audioBucket);
}
