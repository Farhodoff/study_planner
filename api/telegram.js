import authTwaHandler from './_telegram/auth-twa.js';
import webhookHandler from './_telegram/webhook.js';
import notifyDailyHandler from './_telegram/notify-daily.js';
import dispatchDailyHandler from './_telegram/dispatch-daily-dataset.js';
import generateCodeHandler from './_telegram/generate-code.js';
import checkLinkHandler from './_telegram/check-link.js';
import unlinkHandler from './_telegram/unlink.js';
import toggleNotificationsHandler from './_telegram/toggle-notifications.js';
import sendTestHandler from './_telegram/send-test.js';
import dispatchGroupBattleHandler from './_telegram/dispatch-group-battle.js';

export default async function handler(req, res) {
  const url = req.url || '';

  if (url.includes('auth-twa')) {
    return authTwaHandler(req, res);
  }
  if (url.includes('webhook')) {
    return webhookHandler(req, res);
  }
  if (url.includes('notify-daily')) {
    return notifyDailyHandler(req, res);
  }
  if (url.includes('dispatch-daily-dataset')) {
    return dispatchDailyHandler(req, res);
  }
  if (url.includes('dispatch-group-battle')) {
    return dispatchGroupBattleHandler(req, res);
  }
  if (url.includes('generate-code')) {
    return generateCodeHandler(req, res);
  }
  if (url.includes('check-link')) {
    return checkLinkHandler(req, res);
  }
  if (url.includes('unlink')) {
    return unlinkHandler(req, res);
  }
  if (url.includes('toggle-notifications')) {
    return toggleNotificationsHandler(req, res);
  }
  if (url.includes('send-test')) {
    return sendTestHandler(req, res);
  }

  return res.status(404).json({ error: 'Telegram endpoint not found', url });
}
