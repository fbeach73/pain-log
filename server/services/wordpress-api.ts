
import axios from 'axios';

const WP_API_BASE = process.env.WP_API_URL || 'https://painclinics.com/wp-json';

export class WordPressAPI {
  private static instance: WordPressAPI;
  private baseURL: string;
  private apiKey: string;
  
  private constructor() {
    this.baseURL = WP_API_BASE;
    this.apiKey = process.env.WP_API_KEY || '';
  }

  static getInstance(): WordPressAPI {
    if (!WordPressAPI.instance) {
      WordPressAPI.instance = new WordPressAPI();
    }
    return WordPressAPI.instance;
  }

  async createSubscription(userId: string, planData: any) {
    try {
      const response = await axios.post(`${this.baseURL}/wc/v3/subscriptions`, {
        ...planData,
        customer_id: userId,
        status: 'pending'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
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
      const response = await axios.get(`${this.baseURL}/wc/v3/subscriptions/${subscriptionId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('WordPress API Error:', error);
      throw error;
    }
  }

  async getSubscriptionPlans() {
    try {
      const response = await axios.get(`${this.baseURL}/wc/v3/products`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        params: {
          type: 'subscription'
        }
      });
      return response.data;
    } catch (error) {
      console.error('WordPress API Error:', error);
      throw error;
    }
  }
}
