export default {
  "command": ":info",
  "aliases": [';info'],
  "description": "Info about the bot.",
  "action": (msg) => {
    msg.channel.send(
      `**Code:** <https://github.com/orznull/JstrisRoomBot> (made by orz)
**Old Roomba Code:** <https://github.com/LegendWasTaken/Roomba/> (made by Legend)
`
    )
  }
}