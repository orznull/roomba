const WebSocket = require('ws');
const JSTRIS_VERSION = "v1.40.1"
const DEFAULT_ROOM = {
  "t": 11,
  "p": true,
  "n": "1v1 match room",
  "pl": 28,
  "m": 0,
  "at": [0, 0, 1, 2, 4, 4, 6, 2, 0, 10, 1],
  "ct": [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
  "gdm": 3,
  "gblock": 0,
  "rnd": 0,
  "bset": 0,
  "pr": 5,
  "gDelay": 500,
  "mess": 0,
  "gapW": 1,
  "sg": 120,
  "hold": true,
  "hostStart": false,
  "noFW": false,
  "sa": false,
  "gInv": false,
  "as": 0,
  "srv": "0",
  "cd": 0,
  "sl": 0,
  "grav": 1,
  "ld": [500, 5000, 20000],
  "sgpA": [0, 3]
}
let ws = new WebSocket("wss://ws55-f95f480b5cea403d.jezevec10.com/?v=" + JSTRIS_VERSION + "&join=0&guest=1", {
  perMessageDeflate: false,
  origin: "https://jstris.jezevec10.com",
});
ws.on('message', function(message) {
  console.log(message.toString())
  var res = JSON.parse(message.toString());
  if (res.t == 1) {
    ws.send(JSON.stringify(DEFAULT_ROOM))
  }
  if (res.t == 30) {
    onCreate(res)
    ws.terminate()
  }
});

function onCreate(res) {
  console.log(res)
  let ws2 = new WebSocket("wss://ws55-f95f480b5cea403d.jezevec10.com/?v=" + JSTRIS_VERSION + "&sess=" + res.sess, {
    perMessageDeflate: false,
    origin: "https://jstris.jezevec10.com",
  });
  ws2.on('message', function(message) {
    console.log(message.toString())
    var res = JSON.parse(message.toString());
  });
}
