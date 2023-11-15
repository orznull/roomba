/**
 * old deprecated code for a tetrio journey. I refactored it for fun but I'm not going to test it
 * probably won't be used again anyway lol
 */

import axios from "axios";


export default {
  "command": ":match",
  "aliases": [';match'],
  "description": "Lookup a battelfy match for the current bracket. e.g. ;match L23",
  "action": async (msg) => {
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

    var res = axios.get(`https://api.battlefy.com/stages/${bracketID}/matches`);
    try {
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
      msg.channel.send("Something went wrong.")
    }
  }
}