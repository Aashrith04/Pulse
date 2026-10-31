import { NotificationRecord, CanonicalStory, ImportanceLevel } from '../types/index.js';
import { db } from '../db/database.js';
import { getRepository } from '../db/repositoryFactory.js';
import { pushNotificationService } from './pushNotificationService.js';

export interface QuietNotificationEligibility {
  isEligible: boolean;
  reason?: string;
  isDigest?: boolean;
}

export class QuietNotificationService {
  private rollingWindowHours = 3;
  private maxNotificationsPerWindow = 2;
  private storyCooldownHours = 6;

  /**
   * Checks whether the current time falls inside the user's quiet hours
   */
  private isInsideQuietHours(quietStart: string, quietEnd: string, now: Date = new Date()): boolean {
    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight quiet hours, e.g. 22:00 to 07:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Evaluates if a notification is permitted under quiet rules
   */
  checkEligibility(
    userId: string,
    story: CanonicalStory,
    priority: ImportanceLevel
  ): QuietNotificationEligibility {
    const prefs = db.getPreferences(userId);

    // 1. Check if notifications are disabled entirely
    if (!prefs.enableNotifications) {
      return { isEligible: false, reason: 'Notifications disabled by user preference' };
    }

    // 2. Check quiet hours (Critical public safety can bypass if explicitly configured)
    const isQuiet = this.isInsideQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd);
    if (isQuiet && priority !== 'critical') {
      return { isEligible: false, reason: 'Current time is within user quiet hours' };
    }

    // 3. Priority gating: Low priority stories never generate notifications
    if (priority === 'low') {
      return { isEligible: false, reason: 'Low priority stories do not trigger notifications' };
    }

    const pastNotifications = db.getNotifications(userId);
    const nowTime = Date.now();

    // 4. Check story cooldown: Max 1 notification for same underlying story within 6 hours
    const existingStoryNotif = pastNotifications.find(n => 
      n.storyId === story.id &&
      (nowTime - new Date(n.deliveredAt).getTime()) < (this.storyCooldownHours * 3600 * 1000)
    );

    if (existingStoryNotif && priority !== 'critical') {
      return { isEligible: false, reason: `Story was already notified within ${this.storyCooldownHours}h cooldown` };
    }

    // 5. Rolling window check: Max 2 notifications in any rolling 3-hour window
    const windowStart = nowTime - (this.rollingWindowHours * 3600 * 1000);
    const windowNotifs = pastNotifications.filter(n => 
      new Date(n.deliveredAt).getTime() >= windowStart && n.priority !== 'critical'
    );

    if (windowNotifs.length >= this.maxNotificationsPerWindow && priority !== 'critical') {
      return { 
        isEligible: false, 
        reason: `Rate limit reached: Maximum ${this.maxNotificationsPerWindow} notifications per rolling ${this.rollingWindowHours}h window` 
      };
    }

    return { isEligible: true };
  }

  /**
   * Sends or bundles an eligible notification
   */
  dispatchNotification(
    userId: string,
    story: CanonicalStory,
    priority: ImportanceLevel = story.importanceLevel
  ): NotificationRecord | null {
    const eligibility = this.checkEligibility(userId, story, priority);
    if (!eligibility.isEligible) {
      return null;
    }

    const dedupKey = `notif-${story.id}-${Math.floor(Date.now() / (this.storyCooldownHours * 3600 * 1000))}`;
    
    const notif: NotificationRecord = {
      id: `notif-${Date.now()}`,
      userId,
      storyId: story.id,
      dedupKey,
      priority,
      title: story.title,
      body: story.summary.slice(0, 160) + '...',
      deliveredAt: new Date().toISOString(),
      isDigest: false,
      bundledStoryIds: [story.id],
    };

    const saved = db.addNotification(notif);
    try {
      const repo = getRepository();
      repo.addNotification(notif).catch(e => console.warn('[Notification Service] Cloud sync warning:', e.message));
    } catch (e: any) {
      // Ignored if repo uninitialized during startup
    }

    // Asynchronously trigger Web Push to subscribed devices (non-blocking)
    pushNotificationService.sendToUser(userId, {
      title: notif.title,
      body: notif.body,
      storyId: story.id,
      priority,
    }).catch(err => {
      console.warn('[Notification Service] Background web push delivery error:', err);
    });

    return saved;
  }

  /**
   * Evaluates new developments and sends a concise digest if multiple stories emerge
   */
  evaluatePendingDevelopments(userId: string = 'guest-user-default') {
    const prefs = db.getPreferences(userId);
    if (!prefs.enableNotifications) return null;

    const unnotifiedHighStories = db.getStories({ importance: 'high', limit: 10 }).stories.filter(s => {
      const past = db.getNotifications(userId);
      return !past.some(n => n.storyId === s.id);
    });

    if (unnotifiedHighStories.length === 0) return null;

    if (unnotifiedHighStories.length > 1) {
      // Create a bundled digest rather than multi-spam
      const storiesToBundle = unnotifiedHighStories.slice(0, 3);
      const notif: NotificationRecord = {
        id: `digest-${Date.now()}`,
        userId,
        dedupKey: `digest-${Math.floor(Date.now() / (3 * 3600 * 1000))}`,
        priority: 'high',
        title: `${storiesToBundle.length} Important Developments Today`,
        body: storiesToBundle.map(s => `• ${s.title.slice(0, 60)}...`).join('\n'),
        deliveredAt: new Date().toISOString(),
        isDigest: true,
        bundledStoryIds: storiesToBundle.map(s => s.id),
      };
      const saved = db.addNotification(notif);
      try {
        const repo = getRepository();
        repo.addNotification(notif).catch(e => console.warn('[Notification Service] Cloud sync warning:', e.message));
      } catch (e: any) {
        // Ignored if repo uninitialized during startup
      }
      pushNotificationService.sendToUser(userId, {
        title: notif.title,
        body: notif.body,
        priority: 'high',
        tag: 'pulse-digest',
      }).catch(err => {
        console.warn('[Notification Service] Background digest push error:', err);
      });
      return saved;
    } else {
      return this.dispatchNotification(userId, unnotifiedHighStories[0]);
    }
  }
}

export const notificationService = new QuietNotificationService();
