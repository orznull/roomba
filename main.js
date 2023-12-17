import Discord from "discord.js"
import 'dotenv/config';

import createRoom from "./commands/createRoom.js";
import pingFriendlies from "./commands/pingFriendlies.js";
import togglePing from "./commands/togglePing.js";
import botInfo from "./commands/botInfo.js";
import helpCommand from "./commands/helpCommand.js";
import setVersion from "./commands/setVersion.js";
import toggleHere from "./commands/toggleHere.js";
import pingHere from "./commands/pingHere.js";
import findMatch from "./commands/tetrio-journey-match-lookup/findMatch.js";
import setBracket from "./commands/tetrio-journey-match-lookup/setBracket.js";

import { initStorage } from "./modules/storage.js";

export const commands = [
  createRoom,
  pingFriendlies,
  togglePing,
  botInfo,
  helpCommand,
  setVersion,
  toggleHere,
  pingHere,
  findMatch,
  setBracket,
]



initStorage();

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


