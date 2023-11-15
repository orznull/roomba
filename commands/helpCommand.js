import { commands } from "../main.js";

export default {
  "command": ":help",
  "aliases": [';help'],
  "description": "Displays a short description of each command.",
  "action": (msg) => {
    var msgStr = "```ini\n";
    for (let { command, description } of commands) {
      msgStr += `[ ${command} ] - ${description} \n\n`;
    }
    msgStr += "```"
    msg.channel.send(msgStr);
  }
}