import { createNotificationProcessor } from '~/server/notifications/base.notifications';
import { parseBuzzTransactionDetails } from '~/utils/buzz';

export const buzzNotifications = createNotificationProcessor({
  'tip-received': {
    displayName: 'Tip Received',
    prepareMessage: ({ details }) => {
      const { url, notification } = parseBuzzTransactionDetails(details);
      return {
        message: `${notification}${details.message ? ` They said: "${details.message}".` : ''}`,
        url,
      };
    },
  },
});
