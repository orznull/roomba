import { Permissions } from "discord.js"

export const messageAuthorHasAdminPerms = (msg) =>
  (msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, true) || msg.author.id === process.env.OWNER_ID)
