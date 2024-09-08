import { getVal, setVal } from "../modules/storage.js";
import { Permissions } from "discord.js";
import { fetchTetrioUserInfo } from "../util/tetrioApi.js";
import { messageAuthorHasAdminPerms } from "../util/messageAuthorHasAdminPerms.js";

export const TETRIO_USERS_KEY = "linkedTetrioUsers";


const action = async (msg) => {
  const args = msg.content.split(" ");

  const ioUsername = args[1];
  if (!ioUsername) return msg.channel.send("missing arg, input TETR.IO username.")

  if (args[2] && !messageAuthorHasAdminPerms(msg)) return msg.channel.send("You don't have perms to link other's TETR.IO accounts.")

  const usersCache = getVal(TETRIO_USERS_KEY, {});

  const { user: ioUser, error } = await fetchTetrioUserInfo(ioUsername);
  if (error) return msg.channel.send(error);

  if (args[2] && messageAuthorHasAdminPerms(msg)) {
    try {
      const discordUserID = args[2].replace(/\D/g, '');
      const member = await msg.guild.members.fetch(discordUserID);

      if (usersCache[member.user.id])
        return msg.channel.send(`<@${member.user.id}> is already linked to TETR.IO user **[${usersCache[member.user.id]}](https://ch.tetr.io/u/${usersCache[member.user.id]})**. \`;unlink\` it first.`)
      setVal(TETRIO_USERS_KEY, { ...usersCache, [member.user.id]: ioUser.username })
      return msg.channel.send(`\`[Admin Override]\` Linked <@${member.user.id}> to **[${ioUser.username}](https://ch.tetr.io/u/${ioUser.username})**.`);
    } catch (e) {
      return msg.channel.send(`Error linking user. Verify that user \`${args[2]}\` is in the server. This argument should be a mention.`)
    }
  }

  const connectedDiscordID = ioUser?.connections?.discord?.id;
  const discordID = msg.author.id

  if (usersCache[msg.author.id])
    return msg.channel.send(`You are already linked to TETR.IO user **[${usersCache[msg.author.id]}](https://ch.tetr.io/u/${usersCache[msg.author.id]})**. \`;unlink\` if this is a mistake.`)

  if (!connectedDiscordID || connectedDiscordID !== discordID) {
    return msg.channel.send(
      `**[${ioUser.username}](https://ch.tetr.io/u/${ioUser.username}) is not connected to <@${discordID}>.**\n`
      + `Please connect your discord account under TETR.IO config > account, and ensure your username is displayed publicly while trying to link your account. You may undisplay it afterwards.`
    );
  }

  setVal(TETRIO_USERS_KEY, { ...usersCache, [discordID]: ioUser.username })
  return msg.channel.send(`Linked <@${discordID}> to **[${ioUser.username}](https://ch.tetr.io/u/${ioUser.username})**.`);
}


export default {
  command: ":link",
  aliases: [';link'],
  description: `Usage: :link (TETR.IO username) (discord user mention, requires admin) | Link your discord account to your TETR.IO account for friendlies pings. Requires public discord connection on your TETR.IO account, under config -> account on TETR.IO`,
  action,
}