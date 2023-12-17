import axios from "axios";
import { BRACKET_ID_KEY, BRACKET_KEY } from "./setBracket.js";
import { getVal } from "../../modules/storage.js";


export default {
  "command": ":match",
  "aliases": [';match'],
  "description": "Lookup a battelfy match for the current bracket. e.g. ;match L23.\nIf these are not up to date, run ;bracket again.",
  "action": async (msg) => {
    var num = msg.content.split(" ")[1];
    var side = msg.content.split(" ")[2];
    if (!num)
      return msg.channel.send("Invalid match number.")

    const bracket = getVal(BRACKET_KEY);
    const bracketID = getVal(BRACKET_ID_KEY);

    if (!bracket)
      return msg.channel.send("Bracket hasn't been set / fetched. Run ;bracket.");

    var winners = true;
    if (side && side.toLowerCase().startsWith('l'))
      winners = false;

    var rounds = bracket.bracket.series;
    var winnerLength = rounds.filter(e => e.roundType == "championship").length
    var loserLength = rounds.filter(e => e.roundType == "consolation").length
    var specialRoundNames = ['Finals', 'Semifinals', 'Quarterfinals'];

    try {
      var res = await axios.get(`https://api.battlefy.com/stages/${bracketID}/matches`);
      const data = res.data
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
      msg.channel.send("Something went wrong.")
    }
  }
}

// helper functions to find stuff

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

async function findCountry(playerName) {
  if (!playerName)
    return new Promise((resolve, reject) => resolve('n/a'))

  try {
    const res = await axios.get(`https://ch.tetr.io/api/users/${escape(playerName.toLowerCase())}`);
    const country = res?.data?.user?.country ?? "n/a";
    return country;
  } catch (err) {
    return "n/a"
  }
}
