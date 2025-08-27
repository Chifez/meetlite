export const getMeetingInviteEmailTemplate = ({
  meeting,
  joinUrl,
  hostEmail,
}) => {
  const meetingDate = new Date(meeting.scheduledTime);
  const timeString = meetingDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dateString = meetingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    subject: `You're Invited: ${meeting.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meeting Invitation</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .email-container { max-width: 480px; width: 100%; margin: 20px; background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(160, 120, 255, 0.2); overflow: hidden; }
          .header-padding { background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%); padding: 24px 20px 16px 20px; text-align: center; }
          .content-padding { padding: 24px 20px 20px 20px; }
          .title-size { color: #fff; font-size: 1.4rem; margin: 0; font-weight: 700; letter-spacing: -0.5px; }
          .subtitle-size { color: #ede9fe; font-size: 0.9rem; margin: 4px 0 0 0; }
          .meeting-title { color: #7c3aed; margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 600; word-wrap: break-word; }
          .meeting-description { color: #555; margin: 0 0 16px 0; font-size: 0.9rem; line-height: 1.4; word-wrap: break-word; }
          .details-padding { background: #f8f7ff; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #7c3aed; }
          .detail-item { margin-bottom: 8px; display: flex; align-items: center; }
          .detail-label { font-weight: 600; color: #374151; min-width: 80px; font-size: 0.9rem; }
          .detail-value { color: #7c3aed; margin-left: 12px; font-size: 0.9rem; flex: 1; }
          .join-button { display: inline-block; background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%); color: #fff; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(124,58,237,0.3); transition: all 0.2s; min-width: 120px; text-align: center; }
          .join-button:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(124,58,237,0.4); }
          .footer-note { color: #888; font-size: 0.8rem; margin-top: 16px; line-height: 1.4; text-align: center; word-wrap: break-word; }
          .bottom-footer { background: #ede9fe; color: #7c3aed; text-align: center; padding: 12px 0; font-size: 0.8rem; border-top: 1px solid #e0e7ff; }
          @media only screen and (max-width: 480px) {
            .email-container { margin: 12px; max-width: calc(100% - 24px); }
            .header-padding { padding: 20px 16px 12px 16px; }
            .content-padding { padding: 20px 16px 16px 16px; }
            .title-size { font-size: 1.2rem; }
            .subtitle-size { font-size: 0.85rem; }
            .details-padding { padding: 12px; margin-bottom: 16px; }
            .join-button { padding: 10px 20px; font-size: 0.9rem; }
            .detail-item { margin-bottom: 6px; }
            .detail-label { font-size: 0.85rem; }
            .detail-value { font-size: 0.85rem; }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header-padding">
            <img src="${
              process.env.LOGO_URL
            }" alt='Brand Logo' style='height: 32px; margin-bottom: 8px; max-width: 100%;' />
            <h2 class="title-size">You're Invited!</h2>
            <p class="subtitle-size">Join a meeting on MeetLite</p>
          </div>
          <div class="content-padding">
            <h3 class="meeting-title">${meeting.title}</h3>
            <p class="meeting-description">${
              meeting.description || 'No description provided.'
            }</p>
            <div class="details-padding">
              <div class="detail-item"><span class="detail-label">📅 Date:</span><span class="detail-value">${dateString}</span></div>
              <div class="detail-item"><span class="detail-label">⏰ Time:</span><span class="detail-value">${timeString} (UTC)</span></div>
              <div class="detail-item"><span class="detail-label">⏱️ Duration:</span><span class="detail-value">${
                meeting.duration
              } minutes</span></div>
              <div class="detail-item"><span class="detail-label">👤 Host:</span><span class="detail-value">${
                hostEmail || meeting.createdBy
              }</span></div>
            </div>
            <div style="text-align: center;"><a href="${joinUrl}" class="join-button">Join Meeting</a></div>
            <p class="footer-note">This link will be active when the host starts the meeting.<br/>If you have questions, reply to this email.</p>
          </div>
          <div class="bottom-footer"><span>Made with <span style="color: #a78bfa;">♥</span> by MeetLite</span></div>
        </div>
      </body>
      </html>
    `,
  };
};

export default getMeetingInviteEmailTemplate;
