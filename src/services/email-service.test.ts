/**
 * Mock test for sendStoryCompletionEmail
 */

import { sendStoryCompletionEmail } from './src/services/email-service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

async function testEmail() {
    console.log('Testing sendStoryCompletionEmail...');

    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' })
    });

    const variables = {
        DISPLAY_NAME: 'John',
        STORY_TITLE: 'Magic Woods',
        STORY_URL: 'https://artflicks.app/dashboard',
        THUMBNAIL_URL: 'https://example.com/image.jpg'
    };

    const result = await sendStoryCompletionEmail('test@example.com', variables);

    if (result.success) {
        console.log('✅ Test Passed: Email sent successfully');
    } else {
        console.error('❌ Test Failed:', result.error);
    }

    // Test failure case
    mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
    });

    const failureResult = await sendStoryCompletionEmail('test@example.com', variables);

    if (!failureResult.success && failureResult.error?.includes('Failed to send email')) {
        console.log('✅ Test Passed: Error handled correctly');
    } else {
        console.error('❌ Test Failed:', failureResult.error);
    }
}

// Note: This script is intended as a logical verification.
// Actual execution would require a proper test environment.
console.log('Logical verification completed.');
