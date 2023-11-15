/**
 * Module for creating jstris rooms.
 */

import WebSocket from 'ws';

// you might need to edit these URLs if jstris gets any server updates and things break
const HOST = "ws-xd8cxueq33c2cewq5.jezevec10.com"
const SESS_HOST = "ws55-f95f480b5cea403d.jezevec10.com"

const WEBSOCKET_URL = `wss://${HOST}`
const SESS_WEBSOCKET_URL = `wss://${SESS_HOST}`

import rulesets from './rulesets.js';
import { getVal } from '../storage.js';

const JOIN_MESSAGE = "Thanks for joining the room! Seeya! -Roomba"
export const JSTRIS_VERSION_KEY = "JSTRIS_VERSION"

export const createJstrisRoom = ({
  onCreate,
  onPlayerJoin,
  onAbandoned,
  onError,
  ruleset
}) => {

  // we need to pass a version query param into the web socket url
  const version = getVal(JSTRIS_VERSION_KEY, process.env.JSTRIS_VERSION)

  // note we log in as a guest here, so no login required.
  var ws = new WebSocket(`${WEBSOCKET_URL}/?v=${version}&join=0&guest=1&nt=8023&gSess=837623290:3350456168`, {
    // half of these params might not be necessary, just left a lot in from troubleshooting lmao
    headers: {
      'Origin': "https://jstris.jezevec10.com",
      'Host': HOST,
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
      'Cookie': "ga=GA1.2.2010432992.1642742871; _gid=GA1.2.712740183.1642742871; _gat=1"
    }
  });

  ws.on('open', (connection) => {
    // ruleset initialization
    var rs = rulesets[ruleset] ?? rulesets['default']
    ws.send(JSON.stringify(rs)); // send ruleset
    ws.send(JSON.stringify({ // Get room info request
      t: 7
    }));
  });

  ws.on('error', () => {
    onError("Error when creating room on jstris.")
  })

  var roomAbandonedTimeout = setTimeout(
    () => {
      if (ws) {
        ws.terminate();
        onAbandoned();
      }
    },
    process.env.ROOM_ABANDONED_TIMEOUT);

  // Sometimes we can connect to the ws but js is pooping itself and doesn't give us a room.
  // I literally don't remember when this happened but this timeout is here so it probably did.
  var roomRequestTimeout = setTimeout(
    () => {
      if (ws) {
        ws.terminate();
        // cancel the room abandoned timeout because we errored.
        clearTimeout(roomAbandonedTimeout);
        onError("Request to Jstris timed out.");
      }
    },
    process.env.ROOM_CREATION_REQUEST_TIMEOUT ?? 5000);

  ws.on('message', function (message) {
    var res = JSON.parse(message.toString());
    // case 1: we get the room code response and immediately are put into the room without needing to join a sess.
    // note: I'm not sure if this case ever actually occurs anymore. might be dead code but I cba
    if (res.t == 12) {
      clearTimeout(roomRequestTimeout);
      onCreate(`https://jstris.jezevec10.com/?join=${res.rid}`);
    }

    // In case 1 then, we don't yet close the socket until someone joins or the room abandoned timeout fires.
    if (res.t == 2) {
      sendMessage(ws, JOIN_MESSAGE);
      clearTimeout(roomAbandonedTimeout);
      onPlayerJoin(res.n);
      ws.terminate();
    }

    // case 2: we get back a message with a session id that we need to join, so we go do that to see who joins the room.
    if (res.t == 30) {
      // clear both timeouts, we're going to set them again when we try to join the session.
      clearTimeout(roomRequestTimeout);
      clearTimeout(roomAbandonedTimeout);
      onCreate(`https://jstris.jezevec10.com/?join=${res.rid}`);
      joinRoomBySession(res.sess, { onPlayerJoin, onAbandoned, onError });
      ws.terminate();
    }

  });
}

// little shorthand function to send a text message in a socket connected to a js lobby.
const sendMessage = (ws, m) => {
  ws.send(JSON.stringify({ t: 6, m }));
}

// joins a jstris room by session id with a guest account.
export const joinRoomBySession = (sessionId, { onPlayerJoin, onAbandoned, onError }) => {
  const version = getVal(JSTRIS_VERSION_KEY, process.env.JSTRIS_VERSION)
  var ws = new WebSocket(`${SESS_WEBSOCKET_URL}/?v=${version}&sess=${sessionId}`, {
    perMessageDeflate: false,
    'Origin': "https://jstris.jezevec10.com",
    'Host': HOST,
    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
    'Cookie': "ga=GA1.2.2010432992.1642742871; _gid=GA1.2.712740183.1642742871; _gat=1"
  });

  // set another room abandoned timeout
  var roomAbandonedTimeout = setTimeout(
    () => {
      if (ws) {
        ws.terminate();
        onTimeout();
      }
    },
    process.env.ROOM_ABANDONED_TIMEOUT);

  ws.on('error', function (error) {
    onError("Error when joining session.")
  });



  // Send an init message on socket open.
  ws.on('open', () => {
    ws.send(JSON.stringify({ "t": 16, "mode": 0 }));
  });

  ws.on('message', function (message) {
    try {
      let res = JSON.parse(message.toString());
      if (res.t == 2) { // player join message
        sendMessage(ws, JOIN_MESSAGE);
        clearTimeout(roomAbandonedTimeout);
        onPlayerJoin(res.n);
        ws.terminate();
      }
    } catch (e) {
      // likely packed game messages that can't be json parsed
    }
  });
}
