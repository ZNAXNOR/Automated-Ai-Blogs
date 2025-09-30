import { ai } from '../clients/genkitInstance';
import axios from 'axios';
import { defineSecret } from 'firebase-functions/params';
import { r7_publish_input, r7_publish_output } from '../schemas/r7_publish.schema';

// Secrets / config
const WP_API_URL = process.env.WP_API_URL || 'https://odlabagency.wpcomstaging.com/';
const WP_USERNAME = process.env.WP_USERNAME || 'odomkardalvi';
const WP_PASSWORD = defineSecret('WP_PASSWORD');

// Define the flow
export const r7_publish = ai.defineFlow(
  {
    name: 'r7_publish',
    inputSchema: r7_publish_input,
    outputSchema: r7_publish_output,
  },
  async (input) => {
    const password = WP_PASSWORD.value();
    if (!password) {
      throw new Error('WP_PASSWORD secret not defined or accessible');
    }

    const auth = Buffer.from(`${WP_USERNAME}:${password}`).toString('base64');

    const resp = await axios.post(
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

    return {
      id: resp.data.id,
      link: resp.data.link,
      status: resp.data.status,
    };
  }
);

console.log('Loading r7_publish flow definition');
