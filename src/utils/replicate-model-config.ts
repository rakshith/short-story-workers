/**
 * Replicate Model Image Input Configuration
 * 
 * This utility maps Replicate models to their expected image input parameter names.
 * Add new model patterns here to support additional models.
 */

export interface ModelImageConfig {
    /** Field name for single image input */
    singleField?: string;
    /** Field name for multiple image inputs */
    multiField?: string;
    /** Whether to also set single field when multi images provided */
    setSingleFromFirst?: boolean;
    /** Minimum width required by the model */
    minWidth?: number;
    /** Default input parameters to apply for this model */
    defaultInputs?: Record<string, any>;
    /** If true, width and height will not be sent to the model */
    ignoreWidthHeight?: boolean;
}

/**
 * Model image input configurations
 * Key: model pattern (matched against model name, case-insensitive)
 * Value: configuration for how to attach image inputs
 * 
 * To add a new model:
 * 1. Add a new entry with the model pattern as key
 * 2. Specify singleField for single image input
 * 3. Specify multiField for multiple image inputs
 * 4. Set setSingleFromFirst: true if model needs both fields
 */
export const MODEL_IMAGE_CONFIGS: Record<string, ModelImageConfig> = {
    // Flux Redux/reference models
    'flux-redux-schnell': { singleField: 'redux_image' },
    'flux-redux': { multiField: 'reference_images' },

    //black-forest-labs/flux-dev
    'flux-dev': { singleField: 'image' },

    //black-forest-labs/flux-redux-dev
    'flux-redux-dev': { singleField: 'redux_image' },

    //black-forest-labs/flux-1.1-pro-ultra
    'flux-1.1-pro-ultra': { singleField: 'image_prompt' },

    //black-forest-labs/flux-kontext-pro
    'flux-kontext-pro': { singleField: 'input_image' },


    //ideogram-ai/ideogram-v3-turbo
    'ideogram-v3-turbo': { singleField: 'image' },

    //ideogram-ai/ideogram-v3-quality
    'ideogram-v3-quality': { singleField: 'image' },

    //google/nano-banana
    'nano-banana': { multiField: 'image_input' },

    //google/nano-banana-pro
    'nano-banana-pro': { multiField: 'image_input' },

    //google/gemini-2.5-flash-image
    'gemini-2.5-flash-image': { multiField: 'image_input' },

    //bytedance/seedream-4
    'seedream-4': { multiField: 'image_input', defaultInputs: { size: '4K' }, ignoreWidthHeight: true },

    //bytedance/seedream-4.5
    'seedream-4.5': { multiField: 'image_input', defaultInputs: { size: '4K' }, ignoreWidthHeight: true },

    //runwayml/gen4-image-pro
    'gen4-image-pro': { singleField: 'image' },

    //runwayml/gen4-image-turbo
    'gen4-image-turbo': { multiField: 'reference_images' },

    // Default fallback (works for most flux-based models)
    'default': { singleField: 'input_image', multiField: 'image_prompt', setSingleFromFirst: true },
};

/**
 * Detects model type from model name and returns appropriate config
 */
export function getModelImageConfig(modelName: string): ModelImageConfig {
    const lowerModel = modelName.toLowerCase();

    for (const [pattern, config] of Object.entries(MODEL_IMAGE_CONFIGS)) {
        if (pattern !== 'default' && lowerModel.includes(pattern)) {
            return config;
        }
    }

    return MODEL_IMAGE_CONFIGS['default'];
}

/**
 * Attaches image inputs to the Replicate input object based on model type
 * 
 * @param input - The Replicate input object to modify
 * @param model - The model name (e.g., "black-forest-labs/flux-kontext-pro")
 * @param images - Array of image URLs to attach
 */
export function attachImageInputs(
    input: Record<string, any>,
    model: string,
    images: string[] | undefined
): void {
    if (!images || images.length === 0) return;

    const config = getModelImageConfig(model);

    // Attach multi-image field if configured
    if (config.multiField) {
        input[config.multiField] = images;
    }

    // Attach single image field
    if (config.singleField) {
        // Use first image for single field, or set if setSingleFromFirst is true
        if (images.length === 1 || config.setSingleFromFirst) {
            input[config.singleField] = images[0];
        }
    }
}
