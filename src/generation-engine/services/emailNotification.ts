// Email Notification Service - sends completion emails

export interface EmailOptions {
  userId: string;
  storyId: string;
  storyTitle: string;
  storyUrl?: string;
  thumbnailUrl?: string;
}

export class EmailNotificationService {
  private env: any;
  private useMock: boolean;

  constructor(env: any) {
    this.env = env;
    this.useMock = env.GEN_PROVIDER === 'mock';
  }

  async sendCompletionEmail(options: EmailOptions): Promise<boolean> {
    if (this.useMock) {
      console.log(`[EmailNotification] Mock - would send completion email for story ${options.storyId}`);
      return true;
    }

    if (!this.env.APP_URL) {
      console.warn('[EmailNotification] APP_URL not set, skipping email');
      return false;
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', options.userId)
        .single();

      if (profileError || !profile?.email) {
        console.warn(`[EmailNotification] No profile/email found for user ${options.userId}`);
        return false;
      }

      const response = await fetch('https://artflicks.app/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: profile.email,
          templateId: 'story-completion',
          variables: {
            DISPLAY_NAME: profile.display_name || 'there',
            STORY_TITLE: options.storyTitle || 'Your Story',
            STORY_URL: options.storyUrl || `https://artflicks.app/short-stories`,
            THUMBNAIL_URL: options.thumbnailUrl || 'https://artflicks.app/short-stories'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EmailNotification] Failed to send email:', errorText);
        return false;
      }

      console.log(`[EmailNotification] Completion email sent to ${profile.email}`);
      return true;
    } catch (error) {
      console.error('[EmailNotification] Error sending completion email:', error);
      return false;
    }
  }

  async sendFailureEmail(options: { userId: string; storyTitle: string; error: string }): Promise<boolean> {
    if (this.useMock || !this.env.APP_URL) {
      console.log(`[EmailNotification] Mock - would send failure email`);
      return true;
    }

    console.log(`[EmailNotification] Failure email for story: ${options.storyTitle}, error: ${options.error}`);
    return true;
  }
}

export function createEmailNotificationService(env: any): EmailNotificationService {
  return new EmailNotificationService(env);
}
