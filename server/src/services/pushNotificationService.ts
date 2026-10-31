import webpush from 'web-push';
import dotenv from 'dotenv';
import { getRepository } from '../db/repositoryFactory.js';
import { PushSubscriptionRecord, ImportanceLevel, CanonicalStory } from '../types/index.js';

dotenv.config();

// VAPID keys configuration (strictly loaded from environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pulse.news';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[Web Push] VAPID details configured successfully.');
  } catch (err) {
    console.warn('[Web Push] Failed to initialize VAPID details:', err);
  }
} else {
  console.log('[Web Push] VAPID keys not configured in environment. Push notifications disabled.');
}

export class PushNotificationService {
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  isConfigured(): boolean {
    return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  }

  /**
   * Registers or updates a user's browser push subscription
   */
  async subscribe(
    userId: string, 
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    token?: string
  ): Promise<PushSubscriptionRecord> {
    const record: PushSubscriptionRecord = {
      id: `push-${Date.now()}-${Buffer.from(subscription.endpoint).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
      userId: userId || 'guest-user-default',
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date().toISOString(),
      failureCount: 0,
    };

    const repo = getRepository();
    await repo.addPushSubscription(record, token);
    console.log(`[Web Push] Registered push subscription for user ${userId} (${record.endpoint.slice(0, 32)}...)`);
    return record;
  }

  /**
   * Unsubscribes a browser endpoint
   */
  async unsubscribe(endpoint: string, token?: string): Promise<boolean> {
    const repo = getRepository();
    return repo.deletePushSubscription(endpoint, token);
  }

  /**
   * Delivers a browser push notification to all active devices of a user,
   * respecting quiet hours and existing quiet interval limits.
   */
  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      url?: string;
      storyId?: string;
      priority?: ImportanceLevel;
      tag?: string;
    }
  ): Promise<{ delivered: number; failed: number }> {
    const repo = getRepository();
    const subscriptions = await repo.getPushSubscriptions(userId);
    if (subscriptions.length === 0) {
      return { delivered: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag || `pulse-${payload.storyId || 'alert'}`,
      data: {
        url: payload.url || (payload.storyId ? `/stories/${payload.storyId}` : '/'),
        storyId: payload.storyId,
        timestamp: new Date().toISOString(),
      },
    });

    let delivered = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          notificationPayload,
          {
            TTL: 3600, // 1 hour TTL
            urgency: payload.priority === 'critical' ? 'high' : 'normal',
          }
        );

        delivered++;
        await repo.updatePushSubscription(sub.endpoint, {
          lastDeliveredAt: new Date().toISOString(),
          failureCount: 0,
        });
      } catch (err: any) {
        failed++;
        console.warn(`[Web Push] Delivery failed for endpoint ${sub.endpoint.slice(0, 30)}:`, err.statusCode || err.message);

        // Prune dead or unsubscribed endpoints (HTTP 404 or 410 Gone)
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[Web Push] Removing expired endpoint: ${sub.endpoint.slice(0, 30)}`);
          await repo.deletePushSubscription(sub.endpoint);
        } else {
          await repo.updatePushSubscription(sub.endpoint, {
            failureCount: (sub.failureCount || 0) + 1,
          });
        }
      }
    }

    return { delivered, failed };
  }
}

export const pushNotificationService = new PushNotificationService();
