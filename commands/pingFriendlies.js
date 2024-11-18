import { getVal } from "../modules/storage.js";
import { millisToMinutesAndSeconds } from "../util/millisToMinutesAndSeconds.js";
import { getTetrioStatsFromLinkedDiscord } from "../util/tetrioApi.js";
import { PING_BLACKLIST_KEY } from "./blacklistPing.js";

export const PING_CHANNELS_KEY = "pingChannels";

const FRIENDLIES_ROLE = process.env.FRIENDLIES_ROLE_ID

export default {
  command: ":ping",
  aliases: [';ping'],
  description: `Usage: :ping (message) | Ping the friendlies role with the game you want to play. 30 minute cool down (by channel).`,
  action: async (msg) => {
    const blacklist = getVal(PING_BLACKLIST_KEY, []);
    if (blacklist.includes(msg.author.id)) return msg.channel.send("You have been blacklisted from this command.");

    const pingChannels = getVal(PING_CHANNELS_KEY, {});

    var channelLastUsed = pingChannels[msg.channel.id]

    if (!channelLastUsed)
      return msg.channel.send("**That command can't be used here!** Ask someone with perms to allow it in this channel.")
    var timeRemaining = process.env.PING_COOLDOWN - (Date.now() - channelLastUsed);
    if (timeRemaining > 0)
      return msg.channel.send(`**That's on cooldown!** Someone just asked to play recently, ping them and see if they're still here!`
        + `:ping can be used in **${millisToMinutesAndSeconds(timeRemaining)}**`);
    var message = '';
    if (msg.content.length > '!here '.length)
      message = msg.content.substring('!here '.length)

    const stats = await getTetrioStatsFromLinkedDiscord(msg.author.id) ?? ""
    msg.channel.send(
      `<@&${FRIENDLIES_ROLE}> - ${msg.author.toString()} wants to play${message.length > 0 ? ": " + message : "!"}\n`
      + stats
    );
    pingChannels[msg.channel.id] = Date.now();
  }
}