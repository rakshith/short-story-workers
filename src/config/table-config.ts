  // ROOT BUCKET NAME
  export const ROOT_BUCKET_NAME: 'images' = 'images';
  export const ROOT_BUCKET_NAME_VIDEOS: 'videos' = 'videos';
  export const ROOT_BUCKET_NAME_AUDIO: 'audio' = 'audio';
  export const video_output_format: 'mp4' = 'mp4';
  export const audio_output_format: 'mp3' = 'mp3';
  
  
  // Short stories
  export const SHORT_STORIES_FOLDER_NAMES = {
    FACELess: 'faceless',
    Gameplay: 'gameplay',
    UGCAds: 'ugc-ads',
    ItalianBrainrot: 'italian-brainrot',
    POV: 'pov',
    AIASMR: 'ai-asmr'
  } as const;
  
  // Supabase Storage Bucket Configuration
  export const FOLDER_NAMES = {
    // User uploaded images (profile pictures, custom uploads)
    USER_UPLOADS: 'user-uploads',
    
    // AI generated images from text-to-image models
    GENERATED_IMAGES: 'generated-images',
    
    // AI generated videos from text-to-video models
    GENERATED_VIDEOS: 'generated-videos',
    
    // Enhanced/edited images using AI enhancement tools
    ENHANCED_IMAGES: 'enhanced-images',
    
    // Inpainted images (AI-powered image editing)
    EDITED_IMAGES: 'edited-images',
  
    // Developer generated images
    DEVELOPER_IMAGES: 'developer-images',
     
    // User avatars and profile pictures
    USER_AVATARS: 'user-avatars',
  
    // Short stories
    SHORT_STORIES: 'short-stories',
  
    // Voice overs
    VOICE_OVERS: 'voice-overs'
  } as const;
  
  // Bucket types for type safety
  export type StorageBucketType = typeof FOLDER_NAMES[keyof typeof FOLDER_NAMES];
  
  // Bucket metadata configuration
  export const FOLDER_CONFIG = {
     [FOLDER_NAMES.USER_UPLOADS]: {
      name: 'user-uploads',
      description: 'User uploaded images and files',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxFileSize: 20 * 1024 * 1024, // 20MB
      folderStructure: ['profile-pictures', 'custom-uploads', 'drafts']
    },
    
    [FOLDER_NAMES.GENERATED_IMAGES]: {
      name: 'generated-images',
      description: 'AI generated images from text-to-image models',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 15 * 1024 * 1024, // 15MB
      folderStructure: ['text-to-image', 'variations', 'style-transfers']
    },
    
    [FOLDER_NAMES.GENERATED_VIDEOS]: {
      name: 'generated-videos',
      description: 'AI generated videos from text-to-video models',
      public: true,
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/mov'],
      maxFileSize: 100 * 1024 * 1024, // 100MB
      folderStructure: ['text-to-video', 'image-to-video', 'video-variations']
    },
    
    [FOLDER_NAMES.ENHANCED_IMAGES]: {
      name: 'enhanced-images',
      description: 'AI enhanced and edited images',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      folderStructure: ['face-enhancement', 'clarity-improvement', 'color-correction']
    },
    
    [FOLDER_NAMES.EDITED_IMAGES]: {
      name: 'edited-images',
      description: 'AI inpainted and edited images',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      folderStructure: ['inpaint', 'object-removal', 'background-change', 'style-transfer']
    },
    
    [FOLDER_NAMES.USER_AVATARS]: {
      name: 'user-avatars',
      description: 'User profile pictures and avatars',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
      folderStructure: ['profile-pictures', 'avatars']
    },
  
    [FOLDER_NAMES.DEVELOPER_IMAGES]: {
      name: 'developer-images',
      description: 'Developer generated images',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 1000 * 1024 * 1024, // 1000MB
      folderStructure: ['img-gen', 'inpaint', 'upscaler', 'img2img', 'text2img', 'brush']
    },
  
    [FOLDER_NAMES.SHORT_STORIES]: {
      name: 'short-stories',
      description: 'Short story related content',
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 125 * 1024 * 1024, // 125MB
      folderStructure: ['faceless', 'gameplay', 'ugc-ads', 'italian-brainrot', 'pov', 'ai-asmr']
    },
  
    [FOLDER_NAMES.VOICE_OVERS]: {
      name: 'voice-overs',
      description: 'AI generated voice-over audio files',
      public: false,
      allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      folderStructure: ['voice-overs']
    }
  
  } as const;
  
  // Helper functions for bucket operations
  export const getFolderConfig = (bucketName: StorageBucketType) => {
    return FOLDER_CONFIG[bucketName];
  };
  
  export const isBucketPublic = (bucketName: StorageBucketType): boolean => {
    return FOLDER_CONFIG[bucketName]?.public || false;
  };
  
  export const getBucketMaxFileSize = (bucketName: StorageBucketType): number => {
    return FOLDER_CONFIG[bucketName]?.maxFileSize || 10 * 1024 * 1024; // Default 10MB
  };
  
  export const getBucketAllowedMimeTypes = (bucketName: StorageBucketType): readonly string[] => {
    return FOLDER_CONFIG[bucketName]?.allowedMimeTypes || ['image/jpeg', 'image/png'];
  };
  
  // Bucket names array for easy iteration
  export const BUCKET_NAMES = Object.values(FOLDER_NAMES);
  
  // Generic function to extract storage path from Supabase storage URL
  export const extractStoragePath = (imageUrl: string, folderPrefix?: string): string => {
    let storagePath = '';
  
    // Pattern 1: /storage/v1/object/public/images/{folderPrefix}/
    if (folderPrefix && imageUrl.includes(`/storage/v1/object/public/images/${folderPrefix}/`)) {
      const urlParts = imageUrl.split(`/storage/v1/object/public/images/${folderPrefix}/`);
      if (urlParts.length === 2) {
        storagePath = `${folderPrefix}/${urlParts[1]}`;
      }
    }
    // Pattern 2: /storage/v1/object/public/images/
    else if (imageUrl.includes('/storage/v1/object/public/images/')) {
      const urlParts = imageUrl.split('/storage/v1/object/public/images/');
      if (urlParts.length === 2) {
        storagePath = urlParts[1];
      }
    }
    // Pattern 3: /storage/v1/object/public/
    else if (imageUrl.includes('/storage/v1/object/public/')) {
      const urlParts = imageUrl.split('/storage/v1/object/public/');
      if (urlParts.length === 2) {
        storagePath = urlParts[1];
      }
    }
  
    return storagePath;
  };
  