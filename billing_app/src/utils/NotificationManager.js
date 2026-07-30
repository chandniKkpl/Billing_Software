import notifee, { TriggerType, AndroidImportance, RepeatFrequency } from '@notifee/react-native';

export class NotificationManager {
  static async requestPermission() {
    await notifee.requestPermission();
  }

  static async setupChannel() {
    const channelId = await notifee.createChannel({
      id: 'dues-reminders',
      name: 'Dues Reminders',
      importance: AndroidImportance.HIGH,
    });
    return channelId;
  }

  static async syncDuesNotifications(accounts) {
    try {
      const channelId = await this.setupChannel();
      
      // Cancel all previously scheduled notifications
      await notifee.cancelAllNotifications();

      let scheduledCount = 0;
      
      for (const account of accounts) {
        if (!account.dueDate || account.balance <= 0) continue;

        const dueDate = new Date(account.dueDate);
        dueDate.setHours(10, 0, 0, 0); // Notify at 10 AM

        // Calculate days left
        const now = new Date();
        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // If it's within 5 days and not strictly overdue (allow up to 0 days left i.e. today)
        if (daysLeft <= 5 && daysLeft >= 0) {
          // Schedule it for the next occurrence of 10 AM
          const notifyDate = new Date();
          notifyDate.setHours(10, 0, 0, 0);
          
          // If 10 AM has already passed today, schedule for tomorrow 10 AM
          if (notifyDate.getTime() <= now.getTime()) {
            notifyDate.setDate(notifyDate.getDate() + 1);
          }

          // Ensure the scheduled date is not past the due date
          if (notifyDate.getTime() <= dueDate.getTime()) {
            const trigger = {
              type: TriggerType.TIMESTAMP,
              timestamp: notifyDate.getTime(),
              repeatFrequency: RepeatFrequency.DAILY, // Repeat daily until cancelled when dues are paid
            };

            await notifee.createTriggerNotification(
              {
                id: `due_${account.id}`,
                title: 'Upcoming Due Reminder',
                body: `${account.name} has a pending due of ₹${account.balance.toFixed(2)} on ${dueDate.toLocaleDateString()}!`,
                android: {
                  channelId,
                  pressAction: { id: 'default' },
                },
              },
              trigger
            );
            scheduledCount++;
          }
        }
      }
      console.log(`Scheduled ${scheduledCount} due reminders`);
    } catch (e) {
      console.error('Error syncing notifications:', e);
    }
  }
}
