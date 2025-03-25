import axios from 'axios';

export class WordPressAPI {
  private static instance: WordPressAPI;

  private constructor() {}

  static getInstance(): WordPressAPI {
    if (!WordPressAPI.instance) {
      WordPressAPI.instance = new WordPressAPI();
    }
    return WordPressAPI.instance;
  }

  async getSubscriptionPlans() {
    try {
      const WP_API_URL = process.env.WP_API_URL;
      const WP_API_KEY = process.env.WP_API_KEY;

      if (!WP_API_URL || !WP_API_KEY) {
        throw new Error('WordPress API configuration missing');
      }

      // Convert API key to base64 for basic auth
      const auth = Buffer.from(`${WP_API_KEY}`).toString('base64');
      
      const response = await axios.get(`${WP_API_URL}/wc/v3/products`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('WordPress API Error:', error);
      throw error;
    }
  }
}