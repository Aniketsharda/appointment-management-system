// utils/reportMessages.js

export async function constructAppointmentSlackMessageBlocks(
  appointmentDate,
  appointmentTime,
  adminName
) {
  try {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "✅ Appointment Confirmation",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*CloudsAnalytics*\n\nYour appointment is confirmed 🎉",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "We're happy to let you know that your appointment has been successfully booked.",
        },
      },
      {
        type: "section",
        block_id: "appointment_details",
        fields: [
          {
            type: "mrkdwn",
            text: `*Consultant:*\n${adminName || "Consultant"}`, // Admin
          },
          {
            type: "mrkdwn",
            text: `*Date:*\n${appointmentDate}`,
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${appointmentTime}`,
          },
        ],
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              "If you have any questions or need to reschedule, contact us at " +
              "<mailto:support@cloudsanalytics.ai|support@cloudsanalytics.ai>.",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Thank you,\n*CloudsAnalytics Team*",
          },
        ],
      },
    ];

    return blocks;
  } catch (error) {
    throw error;
  }
}
