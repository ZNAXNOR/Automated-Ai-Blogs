import axios from 'axios';
import { env } from '../utils/config';

interface PublishResult {
  postUrl: string;
  id: number;
}

export async function publishToWordPress(
  title: string,
  content: string,
  meta: { slug?: string },
  status: 'publish' | 'draft' = 'draft'
): Promise<PublishResult> {
  const { wpApiUrl, wpUsername, wpPassword } = env;

  // Basic Auth via Application Passwords
  const authToken = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');

  try {
    const resp = await axios.post(
      `${wpApiUrl}/posts`,
      {
        title,
        content,
        status,
        slug: meta.slug,
      },
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const data = resp.data;
    return {
      postUrl: data.link || `${env.wpApiUrl}/?p=${data.id}`,
      id: data.id
    };
  } catch (err: any) {
    // Wrap error
    throw new Error(`WordPress publish failed: ${err.response?.status} ${err.response?.data?.message || err.message}`);
  }
}
