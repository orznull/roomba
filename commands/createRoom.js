import { createJstrisRoom } from "../modules/jstris/jstris.js";
//import { createWWCRoom } from "../modules/wwc/wwc.js";

const createRoomCooldowns = {};

const createRoom = (msg) => {
  const lastRoomCreatedTime = createRoomCooldowns[msg.channel.id] ?? 0;
  var timeRemaining = process.env.ROOM_CREATION_COOLDOWN - (Date.now() - lastRoomCreatedTime);
  if (timeRemaining > 0) {
    return msg.channel.send("**Room Creation Cooldown**: " + (timeRemaining / 1000).toFixed(3) + "s");
  }
  createRoomCooldowns[msg.channel.id] = Date.now();

  var gameArgument = msg.content.split(" ")?.[1]?.toLowerCase();

  if (gameArgument === "io" || gameArgument === "t" || gameArgument === "teto" || gameArgument === "tetrio") {
    msg.channel.send("**Command Unavailable.** With TETR.IO's netcode updates in season 2, bots are extremely difficult to maintain. Roomba will return...!",);
  } else if (gameArgument === "wwc") {
    msg.channel.send("WWC's room creation API is currently broken.");
    /*
    // 
    let roomType = msg.content.split(" ")[2];
    msg.channel.send("Creating WWC room...",).then((linkMsg) => {
      createWWCRoom({
        onCreate: (url) => {
          linkMsg.edit(`${url} **(This link will close itself in 1 minute if no one joins)**`)
        },
        onError: () => {
          linkMsg.edit("There was an error with WWC. Please try again or create the room manually.");
        },
      })

    });
    */
  } else { // default is jstris room
    msg.channel.send("Creating jstris room...")
      .then((linkMsg) => {
        createJstrisRoom({
          onCreate: (url) => {
            linkMsg.edit(`${url} **(This link will close itself in 1 minute if no one joins)**`)
          },
          onPlayerJoin: (username) => {
            const msgChopped = linkMsg.content.substring(0, linkMsg.content.indexOf("**("))
            linkMsg.edit(`${msgChopped} (${username} is host of the room)`);
          },
          onAbandoned: () => {
            linkMsg.edit("Nobody joined the room.");
          },
          onError: () => {
            linkMsg.edit("There was an error with jstris. Please try again or make the room manually.");
          },
          // game argument becomes the ruleset for jstris, because it's the default.
          // e.g. :cr mcdt makes a js room with the mcdt ruleset.
          ruleset: gameArgument
        });
      });
  }
}

export default {
  "command": ":cr",
  "aliases": [';cr'],
  "description": "\n:cr io to make a tetrio room. \n:cr wwc (room-setting=nlb,nlh,nlc,tlh,tlb,tlc, nlh is default) to make a wwc room. \n:cr j (or literally anything jstris is default) to make a jstris room.\nThe room will expire in 1 minute if nobody joins.",
  "action": createRoom
}