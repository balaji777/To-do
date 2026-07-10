import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

async function send({ to, subject, html }) {
  if (!resend) {
    console.log(`[email disabled - set RESEND_API_KEY] Would send "${subject}" to ${to}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) console.error(`Failed to send email to ${to}:`, error);
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PRIORITY_COLORS = { low: "#059669", medium: "#d97706", high: "#e11d48" };
const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };
const RECURRENCE_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

function taskMetaTable(todo) {
  const rows = [];
  if (todo.due_date) {
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Due</td><td style="padding:4px 0;font-weight:600;color:#0f172a;">${formatDueDate(todo.due_date)}</td></tr>`
    );
  }
  rows.push(
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Priority</td><td style="padding:4px 0;font-weight:600;color:${PRIORITY_COLORS[todo.priority] || "#0f172a"};">${PRIORITY_LABELS[todo.priority] || todo.priority}</td></tr>`
  );
  if (todo.important) {
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Important</td><td style="padding:4px 0;color:#0f172a;">★ Yes</td></tr>`
    );
  }
  if (todo.recurrence && todo.recurrence !== "none") {
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Repeats</td><td style="padding:4px 0;color:#0f172a;">${RECURRENCE_LABELS[todo.recurrence]}</td></tr>`
    );
  }
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font-size:14px;">${rows.join("")}</table>`;
}

function layout({ heading, bodyHtml }) {
  return `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
      <div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.05em;color:#6366f1;text-transform:uppercase;">Planora</p>
        <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${heading}</h1>
        ${bodyHtml}
      </div>
      <p style="margin:16px 4px;font-size:12px;color:#94a3b8;">You're receiving this because you have an account on Planora.</p>
    </div>
  `;
}

function greetingName(user) {
  return escapeHtml(user.nickname || user.username);
}

export function sendTaskAddedEmail(user, todo) {
  const title = escapeHtml(todo.title);
  return send({
    to: user.email,
    subject: `Task added: ${todo.title}`,
    html: layout({
      heading: "New task added",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(user)}, this was just added to your list:</p>
        <p style="margin:0;font-size:17px;font-weight:600;color:#0f172a;">${title}</p>
        ${taskMetaTable(todo)}
      `,
    }),
  });
}

export function sendTaskDeletedEmail(user, todo) {
  const title = escapeHtml(todo.title);
  return send({
    to: user.email,
    subject: `Task deleted: ${todo.title}`,
    html: layout({
      heading: "Task deleted",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(user)}, this task was removed from your list:</p>
        <p style="margin:0;font-size:17px;font-weight:600;color:#94a3b8;text-decoration:line-through;">${title}</p>
        ${taskMetaTable(todo)}
      `,
    }),
  });
}

const REMINDER_LABELS = {
  1: "Upcoming",
  2: "Due soon",
  3: "Due today",
};

export function sendCollaboratorInviteEmail(owner, invitee) {
  return send({
    to: invitee.email,
    subject: `${owner.nickname || owner.username} invited you to collaborate on their to-do list`,
    html: layout({
      heading: "You've been invited to collaborate",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(invitee)},</p>
        <p style="margin:0 0 8px;color:#334155;"><strong>${escapeHtml(owner.nickname || owner.username)}</strong> invited you to view and edit their to-do list together.</p>
        <p style="margin:16px 0 0;color:#334155;">Log in to Planora and check your pending invites to accept or decline.</p>
      `,
    }),
  });
}

export function sendCollaboratorAcceptedEmail(owner, collaborator) {
  return send({
    to: owner.email,
    subject: `${collaborator.nickname || collaborator.username} accepted your invite`,
    html: layout({
      heading: "Invite accepted",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(owner)},</p>
        <p style="margin:0;color:#334155;"><strong>${escapeHtml(collaborator.nickname || collaborator.username)}</strong> accepted your invite and can now see and edit your to-do list.</p>
      `,
    }),
  });
}

export function sendListShareInviteEmail(owner, invitee, list) {
  return send({
    to: invitee.email,
    subject: `${owner.nickname || owner.username} shared a list with you`,
    html: layout({
      heading: "You've been invited to a shared list",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(invitee)},</p>
        <p style="margin:0 0 8px;color:#334155;"><strong>${escapeHtml(owner.nickname || owner.username)}</strong> invited you to view and edit their list "${escapeHtml(list.name)}".</p>
        <p style="margin:16px 0 0;color:#334155;">Log in to Planora and check your pending invites to accept or decline.</p>
      `,
    }),
  });
}

export function sendListShareAcceptedEmail(owner, collaborator, list) {
  return send({
    to: owner.email,
    subject: `${collaborator.nickname || collaborator.username} accepted your invite`,
    html: layout({
      heading: "Invite accepted",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(owner)},</p>
        <p style="margin:0;color:#334155;"><strong>${escapeHtml(collaborator.nickname || collaborator.username)}</strong> accepted your invite and can now see and edit "${escapeHtml(list.name)}".</p>
      `,
    }),
  });
}

export function sendVerificationEmail(user, token) {
  const verifyUrl = `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/verify-email?token=${token}`;
  return send({
    to: user.email,
    subject: "Verify your email",
    html: layout({
      heading: "Verify your email",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(user)},</p>
        <p style="margin:0 0 16px;color:#334155;">Confirm your email address to finish setting up your account.</p>
        <p style="margin:0;">
          <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:10px 20px;border-radius:8px;font-weight:600;text-decoration:none;">Verify email</a>
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">This link expires in 24 hours.</p>
      `,
    }),
  });
}

export function sendRemindMeEmail(user, todo) {
  const title = escapeHtml(todo.title);
  return send({
    to: user.email,
    subject: `Reminder: ${todo.title}`,
    html: layout({
      heading: "Reminder",
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(user)}, you asked to be reminded about:</p>
        <p style="margin:0;font-size:17px;font-weight:600;color:#0f172a;">${title}</p>
        ${taskMetaTable(todo)}
      `,
    }),
  });
}

export function sendReminderEmail(user, todo, reminderNumber) {
  const title = escapeHtml(todo.title);
  const label = REMINDER_LABELS[reminderNumber] || "Reminder";
  return send({
    to: user.email,
    subject: `${label}: ${todo.title}`,
    html: layout({
      heading: label,
      bodyHtml: `
        <p style="margin:0 0 8px;color:#334155;">Hi ${greetingName(user)}, a reminder about:</p>
        <p style="margin:0;font-size:17px;font-weight:600;color:#0f172a;">${title}</p>
        ${taskMetaTable(todo)}
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Reminder ${reminderNumber} of 3</p>
      `,
    }),
  });
}
