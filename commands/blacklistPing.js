import { getVal, setVal } from "../modules/storage.js";
import { messageAuthorHasAdminPerms } from "../util/messageAuthorHasAdminPerms.js";

export const PING_BLACKLIST_KEY = "ping_blacklist";

const action = async (msg) => {
  const args = msg.content.split(" ");

  if (!args[1]) return msg.channel.send("Please enter a discord @");
  if (!messageAuthorHasAdminPerms(msg)) return msg.channel.send("You don't have perms to do that.");
  const blacklistCache = getVal(PING_BLACKLIST_KEY, []);
  try {
    const discordUserID = args[1].replace(/\D/g, '');
    const member = await msg.guild.members.fetch(discordUserID);
    if (blacklistCache.includes(discordUserID)) return msg.channel.send("User already blacklisted.")
    setVal(PING_BLACKLIST_KEY, [...blacklistCache, discordUserID])
    return msg.channel.send(`Added <@${member.user.id}> to ping blacklist.`);
  } catch (e) {
    console.log(e);
    return msg.channel.send(`Error blacklisting user.`);
  }
}


export default {
  command: ":blacklist",
  aliases: [';blacklist'],
  description: `Usage: :blacklist <discord @> | Blacklists a user from using :ping or :here. Requires admin.`,
  action,
}