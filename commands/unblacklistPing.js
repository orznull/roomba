import { getVal, setVal } from "../modules/storage.js";
import { messageAuthorHasAdminPerms } from "../util/messageAuthorHasAdminPerms.js";
import { PING_BLACKLIST_KEY } from "./blacklistPing.js";

const action = async (msg) => {
  const args = msg.content.split(" ");

  if (!args[1]) return msg.channel.send("Please enter a discord @");
  if (!messageAuthorHasAdminPerms(msg)) return msg.channel.send("You don't have perms to do that.");
  const blacklistCache = getVal(PING_BLACKLIST_KEY, []);
  try {
    const discordUserID = args[1].replace(/\D/g, '');
    const member = await msg.guild.members.fetch(discordUserID);
    if (!blacklistCache.includes(discordUserID)) return msg.channel.send("User is not blacklisted.")
    setVal(PING_BLACKLIST_KEY, blacklistCache.filter(e => e !== discordUserID));
    return msg.channel.send(`Removed <@${member.user.id}> from ping blacklist.`);
  } catch (e) {
    console.log(e);
    return msg.channel.send(`Error unblacklisting user.`);
  }
}


export default {
  command: ":unblacklist",
  aliases: [';unblacklist'],
  description: `Usage: :unblacklist <discord @> | Reallows a blacklisted user to use :ping or :here. Requires admin.`,
  action,
}