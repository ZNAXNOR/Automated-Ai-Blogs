import { ai } from '../clients/genkitInstance';
import axios from 'axios';
import { defineSecret } from 'firebase-functions/params';
import { r7_publish_input, r7_publish_output } from '../schemas/r7_publish.schema';

const WP_API_URL = process.env.WP_API_URL || 'https://odlabagency.wpcomstaging.com/';
const WP_USERNAME = process.env.WP_USERNAME || 'odomkardalvi';
const WP_PASSWORD = defineSecret('WP_PASSWORD');

console.log('[r7_publish]     Flow module loaded');

export const r7_publish = ai.defineFlow(
  {
    name: 'r7_publish',
    inputSchema: r7_publish_input,
    outputSchema: r7_publish_output,
  },
  async (input) => {
    const password = WP_PASSWORD.value(); // consider await if needed
    if (!password) throw new Error('WP_PASSWORD secret not defined or accessible');

    const auth = Buffer.from(`${WP_USERNAME}:${password}`).toString('base64');

    console.log('[r7_publish] Publishing post:', input.title);
    console.log('[r7_publish] Target URL:', `${WP_API_URL.replace(/\/$/, '')}/wp-json/wp/v2/posts`);

    let resp;
    try {
      resp = await axios.post(
        `${WP_API_URL.replace(/\/$/, '')}/wp-json/wp/v2/posts`,
        {
          title: input.title,
          content: input.content,
          status: input.status,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (err) {
      console.error('[r7_publish] Failed to publish post', (err as any).response?.data || err);
      throw err;
    }

    console.log('[r7_publish] Response status:', resp.status);

    if (!resp.data.id || !resp.data.link || !resp.data.status) {
      console.error('[r7_publish] Invalid response from WordPress API');
      throw new Error('Invalid response from WordPress API.');
    }

    return {
      id: resp.data.id,
      link: resp.data.link,
      status: resp.data.status,
    };
  }
);

