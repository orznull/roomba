import { getVal, setVal } from "../modules/storage.js";
import { Permissions } from "discord.js";
import axios from "axios";
import { TETRIO_USERS_KEY } from "./linkTetrio.js";
import { messageAuthorHasAdminPerms } from "../util/messageAuthorHasAdminPerms.js";

const action = async (msg) => {
  const args = msg.content.split(" ");
  if (args[1] && !messageAuthorHasAdminPerms(msg)) return msg.channel.send("You don't have perms to do that.");

  const usersCache = getVal(TETRIO_USERS_KEY);

  if (args[1] && messageAuthorHasAdminPerms(msg)) {
    try {
      const discordUserID = args[1].replace(/\D/g, '');
      const member = await msg.guild.members.fetch(discordUserID);
      if (!usersCache[member.user.id]) return msg.channel.send("No TETR.IO user to unlink.")
      delete usersCache[member.user.id];
      setVal(TETRIO_USERS_KEY, usersCache)
      return msg.channel.send(`Unlinked <@${member.user.id}> from TETR.IO account.`);
    } catch (e) {
      console.log(e);
      return msg.channel.send(`Error unlinking user. Verify that user \`${args[1]}\` is in the server. This argument should be a mention.`)
    }
  }

  const discordID = msg.author.id;
  if (!usersCache[msg.author.id]) return msg.channel.send("No TETR.IO user to unlink.")
  delete usersCache[discordID];
  setVal(TETRIO_USERS_KEY, usersCache);
  return msg.channel.send(`Unlinked <@${msg.author.id}> from TETR.IO account.`);
}


export default {
  command: ":unlink",
  aliases: [';unlink'],
  description: `Usage: :link (user mention, requires admin.) | Unlink your discord account to your TETR.IO account for friendlies pings.`,
  action,
}