import axios from "axios";

export async function sendSlackNotification(req, slackWebhookUrl, payload) {
  try {
    await axios.post(slackWebhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });

    req?.log?.info(
      `Slack notification sent to ${slackWebhookUrl} successfully.`
    );

    return "Slack notification sent successfully.";
  } catch (error) {
    req?.log?.error(
      { error, slackWebhookUrl },
      `Error sending Slack notification to ${slackWebhookUrl}`
    );
    throw error;
  }
}
