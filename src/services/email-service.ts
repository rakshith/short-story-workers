/**
 * Reusable service for sending emails via Artflicks API
 */

export interface EmailVariables {
    DISPLAY_NAME: string;
    STORY_TITLE: string;
    STORY_URL: string;
    THUMBNAIL_URL: string;
}

/**
 * Sends a story completion email to the user
 */
export async function sendStoryCompletionEmail(to: string, variables: EmailVariables) {
    try {
        const response = await fetch('https://artflicks.app/api/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to,
                templateId: 'story-completion',
                variables
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Email Service] Failed to send email to ${to}:`, {
                status: response.status,
                error: errorText
            });
            return { success: false, error: `Failed to send email: ${response.statusText}` };
        }

        const result = await response.json();
        console.log(`[Email Service] Email sent successfully to ${to}`);
        return { success: true, result };
    } catch (error) {
        console.error(`[Email Service] Error sending email to ${to}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
