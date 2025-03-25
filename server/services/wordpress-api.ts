
import axios from 'axios';

const WP_API_BASE = process.env.WP_API_URL || 'https://domain.com/wp-json';

export class WordPressAPI {
  private static instance: WordPressAPI;
  private baseURL: string;
  
  private constructor() {
    this.baseURL = WP_API_BASE;
  }

  static getInstance(): WordPressAPI {
    if (!WordPressAPI.instance) {
      WordPressAPI.instance = new WordPressAPI();
    }
    return WordPressAPI.instance;
  }

  async createSubscription(userId: string, planData: any) {
    try {
      const response = await axios.post(`${this.baseURL}/wc/v3/subscriptions`, planData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WP_API_KEY}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('WordPress API Error:', error);
      throw error;
    }
  }

  async verifySubscription(subscriptionId: string) {
    try {
      const response = await axios.get(`${this.baseURL}/wc/v3/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (error) {
      console.error('WordPress API Error:', error);
      throw error;
    }
  }
}
