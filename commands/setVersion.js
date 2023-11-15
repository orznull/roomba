import { JSTRIS_VERSION_KEY } from "../modules/jstris/jstris.js";
import { setVal } from "../modules/storage.js";

export default {
  "command": ":setversion",
  "aliases": [';setversion'],
  "description": "(needs to be bot owner) Set Jstris version",
  "action": function (msg) {
    if (msg.author.id != process.env.OWNER_ID)
      return msg.channel.send("**You don't have the perms to do that.**")
    const version = msg.content.substring(":setversion ".length);
    setVal(JSTRIS_VERSION_KEY, version)
    saveSettings();
    msg.reply("Version changed to " + version);
  }
}