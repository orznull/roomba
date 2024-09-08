import { Permissions } from "discord.js";

import { getVal, setVal } from "../modules/storage.js";
import { PING_CHANNELS_KEY } from "./pingFriendlies.js"
import { messageAuthorHasAdminPerms } from "../util/messageAuthorHasAdminPerms.js";
export default {
  "command": ":toggleping",
  "aliases": [';toggleping'],
  "description": "(needs manage channels perm or be bot owner) Toggle whether :ping can be used in this channel.",
  "action": function (msg) {
    var pingChannels = getVal(PING_CHANNELS_KEY, {});
    if (!messageAuthorHasAdminPerms(msg))
      return msg.channel.send("**You don't have the perms to do that.**")

    if (pingChannels[msg.channel.id]) {
      delete pingChannels[msg.channel.id];
      setVal(PING_CHANNELS_KEY, pingChannels);
      return msg.channel.send("**Ping permissions revoked from this channel.**")
    }

    pingChannels[msg.channel.id] = -1;
    setVal(PING_CHANNELS_KEY, pingChannels);
    msg.channel.send("**Ping permissions granted to this channel.**")
  }
}