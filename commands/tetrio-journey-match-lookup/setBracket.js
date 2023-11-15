/**
 * old deprecated code for a tetrio journey. I refactored it for fun but I'm not going to test it
 * probably won't be used again anyway lol
 */
import { Permissions } from "discord.js";

export let bracketInfo = {
  bracket: undefined,
  bracketID: undefined
}
export default {
  "command": ":bracket",
  "aliases": [';bracket'],
  "description": "(needs manage channels perm or be orz) Set bracket that the lookup is pointing at.",
  "action": async (msg) => {
    if (msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, false) && msg.author.id != "147820747140759554" && msg.author.id != "177624776699805696")
      return msg.channel.send("**You don't have the perms to do that.**").then((m) => {
      });
    var id = msg.content.split(" ")[1];
    if (id)
      bracketInfo.bracketID = id;

    if (!bracketInfo.bracketID)
      return msg.channel.send("Bracket has not been set");

    const res = await axios.get(`https://dtmwra1jsgyb0.cloudfront.net/stages/${bracketID}`)
    try {
      var data = JSON.parse(b);
      msg.channel.send(`Bracket is set to ${res.data.name}`)
      bracket = data;
    } catch (e) {
      msg.channel.send("Invalid Bracket ID.")
    }
  }
}