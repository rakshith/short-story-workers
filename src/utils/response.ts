// Common response utilities for API endpoints

/**
 * Creates a JSON response with CORS headers
 */
export function jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * Creates a CORS preflight response
 */
export function corsResponse(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

/**
 * Creates a 404 not found response with available endpoints
 */
export function notFoundResponse(method: string, path: string): Response {
    return jsonResponse({
        error: 'Not found',
        message: `The endpoint '${path}' does not exist.`,
        method,
        path,
        availableEndpoints: {
            'POST /workflow/:type': 'Start a generation workflow (faceless-video, character-video, talking-avatar)',
            'POST /cancel-generation': 'Cancel a currently running generation job',
            'GET /status?jobId=<jobId>': 'Check the status of a story generation job',
            'POST /webhooks/replicate': 'Webhook for Replicate callbacks',
            'POST /webhooks/fal': 'Webhook for FAL.ai callbacks',
        },
    }, 404);
}
