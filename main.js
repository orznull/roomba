import Discord from "discord.js"
import 'dotenv/config';

import createRoom from "./commands/createRoom.js";
import pingFriendlies from "./commands/pingFriendlies.js";
import togglePing from "./commands/togglePing.js";
import botInfo from "./commands/botInfo.js";
import helpCommand from "./commands/helpCommand.js";
import setVersion from "./commands/setVersion.js";

export const commands = [
  createRoom,
  pingFriendlies,
  togglePing,
  botInfo,
  helpCommand,
  setVersion,
]

const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES"] });

bot.on('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

//error handle
bot.on('error', console.error);

// comand response
bot.on('message', msg => {
  if (msg.author.bot)
    return;

  for (let { command, aliases, action } of commands) {
    if (msg.content.startsWith(command)) {
      return action(msg);
    }
    for (let alias of aliases) {
      if (msg.content.startsWith(alias)) {
        return action(msg);
      }
    }
  }
});


bot.login(process.env.TOKEN);


