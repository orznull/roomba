import { Permissions } from "discord.js";

import { getVal, setVal } from "../modules/storage.js";
import { HERE_PING_CHANNELS_KEY } from "./pingHere.js"
export default {
  "command": ":togglehere",
  "aliases": [';togglehere'],
  "description": "(needs manage channels perm or be bot owner) Toggle whether :here can be used in this channel.",
  "action": function (msg) {
    var pingChannels = getVal(HERE_PING_CHANNELS_KEY, {});
    if (!msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, true) && msg.author.id != process.env.OWNER_ID)
      return msg.channel.send("**You don't have the perms to do that.**")

    if (pingChannels[msg.channel.id]) {
      delete pingChannels[msg.channel.id];
      setVal(HERE_PING_CHANNELS_KEY, pingChannels);
      return msg.channel.send("**@ here permissions revoked from this channel.**")
    }

    pingChannels[msg.channel.id] = -1;
    setVal(HERE_PING_CHANNELS_KEY, pingChannels);
    msg.channel.send("**@ here permissions granted to this channel.**")
  }
}