import { Permissions } from "discord.js";

import axios from "axios";
import { getVal, setVal } from "../../modules/storage.js";

export const BRACKET_ID_KEY = "bracketID";
export const BRACKET_KEY = "bracket";

let bracket;
let bracketID;

export default {
  "command": ":bracket",
  "aliases": [';bracket'],
  "description": "(needs manage channels perm or be orz) Sets / refreshes the bracket that the match lookup is pointing at.",
  "action": async (msg) => {
    if (msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, false) && msg.author.id != "147820747140759554" && msg.author.id != "177624776699805696")
      return msg.channel.send("**You don't have the perms to do that.**").then((m) => {
      });
    var inputId = msg.content.split(" ")[1];
    if (inputId)
      bracketID = inputId;
    else if (bracketID === undefined)
      bracketID = getVal(BRACKET_ID_KEY, "");


    if (!bracketID)
      return msg.channel.send("Bracket has not been set. Please input a bracket id.");

    try {
      const res = await axios.get(`https://dtmwra1jsgyb0.cloudfront.net/stages/${bracketID}`)
      msg.channel.send(!inputId ? `Refreshed bracket ${res.data.name}` : `Bracket is set to ${res.data.name}`)
      bracket = res.data;
      setVal(BRACKET_ID_KEY, bracketID);
      setVal(BRACKET_KEY, bracket)
    } catch (e) {
      msg.channel.send("Invalid Bracket ID.")
    }
  }
}