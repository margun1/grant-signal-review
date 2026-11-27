import sampleDocument from "../../docs/sample-customer-inquiries.md?raw";

const [inquiries = "", replies = ""] = sampleDocument.split(/^## /m).slice(1);
const sampleRows = (section: string) =>
  section.split("\n").filter((line) => line.startsWith("| CS-"))
    .map((line) => line.slice(2, -2).split(" | "));
const replyById = new Map(sampleRows(replies).map(([id, reply]) => [id, reply]));
const optional = (value: string) => value === "—" ? null : value;

export const sampleCustomerInquiries = sampleRows(inquiries).map(
  ([id, receivedAt, channel, name, org, email, content, status, assignee]) => ({
    id,
    channel,
    name: optional(name),
    org: optional(org),
    email: optional(email),
    content,
    received_at: `${receivedAt.replace(" ", "T")}:00+09:00`,
    assignee: optional(assignee),
    status,
    reply_draft: replyById.get(id) ?? null,
    sample: true as const,
  }),
);
