const Discord = require("discord.js");
const { Permissions } = require('discord.js');
const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES"] });
const fs = require("fs");
const WebSocketClient = require('websocket').client;

const tetrio = require('./tetrio');
const jstris = require('./jstris');

const request = require('request');

var token = "";
var logbookChannel = null;
var pingChannels = {};
var createRoomCooldowns = {};
var version = "";

var bracketID = "";
var bracket = {};


function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}


function findSeed(matches, playerName) {
  if (!playerName)
    return "n/a"
  for (var m of matches) {
    if (m.top.seedNumber && m.top.team && m.top.team.name == playerName)
      return m.top.seedNumber
    if (m.bottom.seedNumber && m.bottom.team && m.bottom.team.name == playerName)
      return m.bottom.seedNumber
  }
}

function findCountry(playerName) {
  if (!playerName)
    return new Promise((resolve, reject) => resolve('n/a'))

  return new Promise((resolve, reject) => {
    request(`https://ch.tetr.io/api/users/${escape(playerName.toLowerCase())}`, (e, r, b) => {
      if (e)
        return resolve("n/a");
      try {
        var response = JSON.parse(b);
        if (response.data && response.data.user && response.data.user.country)
          resolve(response.data.user.country)
        else
          resolve("n/a")
      } catch (e) {
        resolve("n/a");
      }
    })
  })
}


// saves to settings.json
function saveSettings() {
  fs.writeFileSync("./settings.json", JSON.stringify({ token, pingChannels, version }));
}
// Initial settings load
if (!fs.existsSync("./settings.json")) {
  saveSettings();
  console.log("This is your first time running me! Put your bot token in the token field of settings.json.");
  process.exit();
} else {
  var { token, pingChannels, version } = JSON.parse(fs.readFileSync("settings.json"));
}
bot.setInterval(saveSettings, 1000 * 60 * 5);

bot.on('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
});


var cooldownMillis = 30 * 60 * 1000 // 30 minutes

var roomCooldownMillis = 20 * 1000 // 20 seconds
var lastRoomCreatedTime = -1;


// object to hold commands
var commands = {
  ":cr": {
    "aliases": [';cr'],

    "description": "\n:cr io to make a tetrio room. \n:cr wwc (room-setting=nlb,nlh,nlc,tlh,tlb,tlc, nlh is default) to make a wwc room. \n:cr j (or literally anything jstris is default) to make a jstris room.\nThe room will expire in 1 minute if nobody joins.",

    "action": (msg) => {
      lastRoomCreatedTime = createRoomCooldowns[msg.channel.id];

      var timeRemaining = roomCooldownMillis - (Date.now() - lastRoomCreatedTime);
      if (timeRemaining > 0)
        return msg.channel.send("**Room Creation Cooldown**: " + (timeRemaining / 1000).toFixed(3) + "s").then((m) => {
          //setTimeout(()=>m.delete(), 5000);
        });
      else {
        createRoomCooldowns[msg.channel.id] = Date.now();
        var game = msg.content.split(" ")[1]
        if (game)
          game = game.toLowerCase();
        if (game == "io" || game == "t" || game == "teto" || game == "tetrio") {
          msg.channel.send("Creating tetrio room...",).then((m) => {
            tetrio.createRoom((url) => {
              m.edit(url + " **(This link will close itself in 1 minute if no one joins)**")
            }, (joined) => {
              console.log(joined);
              if (joined) {
                var newMsg = m.content.substring(0, m.content.indexOf("**"));
                console.log(newMsg);
                m.edit(newMsg);
              } else {
                m.edit("Nobody joined the room.");
              }
            }, () => {
              m.edit("There was an error. Please try again or make the room manually.");
            });
          });
        } else if (game == "wwc") {
          msg.channel.send("Creating WWC room...",).then((m) => {
            var roomType = msg.content.split(" ")[2];
            request("https://www.worldwide-combos.com/api/roomba?rs="
              + roomType, (e, r, b) => {
                if (e)
                  return m.edit("There was an error with WWC.")
                try {
                  var res = JSON.parse(b);
                  m.edit(`https://www.worldwide-combos.com/custom?c=${res.code}`)
                } catch (e) {
                  return m.edit("There was an error with WWC.")
                }

              });
          });

        } else { // assume jstris room
          msg.channel.send("Creating jstris room...")
            .then((linkMsg) => {
              jstris.createRoom(version, 1000 * 60,
                (res) => { // onCreate
                  linkMsg.edit("https://jstris.jezevec10.com/?join=" + res.rid + " **(This link will close itself in 1 minute if no one joins)**")
                },
                (user) => { // onJoin
                  linkMsg.edit(linkMsg.content.substring(0, linkMsg.content.indexOf("**(")) + " (" + user.n + " is host of the room)");
                },
                () => { // onTimeout
                  linkMsg.edit("Nobody joined the room.");
                },
                () => { // onError
                  linkMsg.edit("There was an error with jstris.");
                },
                game
              );
            });
        }
      }
    }
  },
  ":here": {
    "aliases": [';here'],
    "description": "Usage: !here (game) | Ping @ here the game you want to play. 30 minute cool down (by channel).",
    "action": (msg) => {

      var channelLastUsed = pingChannels[msg.channel.id]

      if (!channelLastUsed)
        return msg.channel.send("**That command can't be used here!** Ask someone with perms to allow it in this channel.").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        })

      var timeRemaining = cooldownMillis - (Date.now() - channelLastUsed);
      if (timeRemaining > 0)
        return msg.channel.send("**That's on cooldown!** Someone just asked to play recently, ping them and see if they're still here! `:here` can be used in **" + millisToMinutesAndSeconds(timeRemaining) + "**").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        })
      var message = '';
      if (msg.content.length > '!here '.length)
        message = msg.content.substring('!here '.length)
      msg.channel.send("@here - " + msg.author.toString() + " wants to play" + (message.length > 0 ? ": " + message + "" : "!"));
      pingChannels[msg.channel.id] = Date.now();
    }
  },

  ":togglehere": {
    "aliases": [';togglehere'],
    "description": "(needs manage channels perm or be orz) Toggle whether !here can be used in this channel.",
    "action": function (msg) {
      if (!msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, true) && msg.author.id != "147820747140759554")
        return msg.channel.send("**You don't have the perms to do that.**").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        });
      if (pingChannels[msg.channel.id]) {
        delete pingChannels[msg.channel.id];
        return msg.channel.send("**Here ping permissions revoked from this channel.**").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        });
      } else {
        pingChannels[msg.channel.id] = -1;
        msg.channel.send("**Here ping permissions granted to this channel.**").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        });
      }

    }
  },

  ":setversion": {
    "aliases": [';setversion'],
    "description": "(needs to be orz) Set Jstris version",
    "action": function (msg) {
      if (msg.author.id != "147820747140759554")
        return msg.channel.send("**You don't have the perms to do that.**").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        });

      version = msg.content.substring(":setversion ".length);
      saveSettings();
      msg.reply("Version changed to " + version);

    }
  },

  ":bracket": {
    "aliases": [';bracket'],
    "description": "(needs manage channels perm or be orz) Set bracket that the lookup is pointing at.",
    "action": function (msg) {
      if (msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, false) && msg.author.id != "147820747140759554" && msg.author.id != "177624776699805696")
        return msg.channel.send("**You don't have the perms to do that.**").then((m) => {
          //setTimeout(()=>m.delete(), 5000)
        });
      var id = msg.content.split(" ")[1];
      if (id)
        bracketID = id;

      if (!bracketID)
        return msg.channel.send("Bracket hasn't been set.");

      request("https://dtmwra1jsgyb0.cloudfront.net/stages/" + bracketID, (e, r, b) => {
        try {
          var data = JSON.parse(b);
          msg.channel.send(`Bracket is set to ${data.name}`)
          bracket = data;
        } catch (e) {
          msg.channel.send("Invalid Bracket ID.")
        }
      })


    }
  },

  ":match": {
    "aliases": [';match'],
    "description": "Lookup a battelfy match at the bracket you set.",
    "action": function (msg) {
      /*
          if (msg.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, false) && msg.author.id != "147820747140759554")
            return msg.channel.send("**You don't have the perms to do that.**").then((m) => {
              //setTimeout(()=>m.delete(), 5000)
            });
      */
      var num = msg.content.split(" ")[1];
      var side = msg.content.split(" ")[2];
      if (!num)
        return msg.channel.send("Invalid match number.")

      if (!bracketID || !bracket)
        return msg.channel.send("Bracket hasn't been set.");

      var winners = true;
      if (side && side.toLowerCase().startsWith('l'))
        winners = false;

      var rounds = bracket.bracket.series;
      var winnerLength = rounds.filter(e => e.roundType == "championship").length
      var loserLength = rounds.filter(e => e.roundType == "consolation").length
      var specialRoundNames = ['Finals', 'Semifinals', 'Quarterfinals'];

      request("https://api.battlefy.com/stages/" + bracketID + "/matches", async (e, r, b) => {
        try {
          var data = JSON.parse(b);
          var match = data.find(e => e.matchNumber == num && e.matchType == (winners ? "winner" : "loser"));
          if (!match)
            return msg.channel.send("Match not found.")

          var length = winners ? winnerLength : loserLength
          var round = (winners ? "Winner's " : "Loser's ")
          //console.log(specialRoundNames[length - match.roundNumber]);
          round += specialRoundNames[length - match.roundNumber] || `Round ${match.roundNumber}`

          if (match.roundNumber > length)
            round = "Grand Finals"

          var topName = match.top.team ? match.top.team.name : null;
          var topSeed = findSeed(data, topName);
          var topCountry = await findCountry(topName);
          var bottomName = match.bottom.team ? match.bottom.team.name : null;
          var bottomSeed = findSeed(data, bottomName);
          var bottomCountry = await findCountry(bottomName);

          msg.channel.send(`${round}\n${topCountry}, Seed ${topSeed} - ${topName || "n/a"} \nvs.\n${bottomCountry}, Seed ${bottomSeed} - ${bottomName || "n/a"}`)

        } catch (err) {
          console.log(err);
          msg.channel.send("Invalid Bracket ID.")
        }
      })
    }
  },



  ":info": {
    "aliases": [';info'],
    "description": "Info about the bot.",
    "action": (msg) => {
      msg.channel.send(
        `**Code:** <https://github.com/orznull/JstrisRoomBot> (made by orz)
**Old Roomba Code:** <https://github.com/LegendWasTaken/Roomba/> (made by Legend)
`
      )
    }
  },

  ":help": {
    "aliases": [';help'],
    "description": "Displays a short description of each command.",
    "action": (msg) => {
      var msgStr = "```ini\n";
      for (command in commands) {
        msgStr += "[ " + command + " ] - " + commands[command].description + "\n\n";
      }
      msgStr += "```"
      msg.channel.send(msgStr);
    }
  }

}
//error handle
bot.on('error', console.error);


// What actually reads and runs the commands.
bot.on('message', msg => {
  if (msg.author.bot)
    return;

  for (var command in commands) {
    if (msg.content.startsWith(command)) {
      return commands[command].action(msg);
    }
    for (var alias of commands[command].aliases) {
      if (msg.content.startsWith(alias)) {
        return commands[command].action(msg);
      }
    }
  }
});

bot.login(token);


