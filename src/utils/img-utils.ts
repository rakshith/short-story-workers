

export const getImageModel = (modelId: string, models: any) => {
    const imageModels = models.models.filter((model: any) => model.id === modelId);
    return imageModels[0];
  };
  
  export const getVideoModel = (modelId: string, models: any) => {
    const videoModels = models.models.filter((model: any) => model.id === modelId);
    return videoModels[0];
  };
  