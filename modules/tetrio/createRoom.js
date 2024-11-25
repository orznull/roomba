/**
 * TETR.IO room creation module.
 * 
 * Probably lots of stuff that isn't actually necessary in here, I threw a lot of stuff at the wall to get this to work lol
 * Uses a dumb method where it re-logs in every single time it creates a room, so I don't have to store any tokens.
 * 
 */
import axios from "axios";
import { Ribbon } from "./ribbon.js";
import 'dotenv/config';
import { log } from "../log.js";
const AUTH_URL = 'https://tetr.io/api/users/authenticate';
const SIGNATURE_URL = 'https://tetr.io/api/server/environment';
const RIBBON_SERVERS_URL = 'https://tetr.io/api/server/ribbon';


// I'm actually unsure if this cookie needs to be set
const COOKIE = `ceriad_exempt=1; cf_clearance=fmZJyxZs382vQThoUEHX9w8umukozhUPuu8_YTf.ZH4-1660013149-0-150`
export const createTetrioRoom = async ({
  onCreate,
  onPlayerJoin,
  onAbandoned,
  onError,
}) => {
  let joinedRoom;
  let roomAbandonedTimeout;
  var body = { username: process.env.TETRIO_BOT_USER, password: process.env.TETRIO_BOT_PASSWORD };
  try {
    log("authorizing");
    const authRes = await axios.post(AUTH_URL, JSON.stringify(body), {
      headers: {
        "cookie": COOKIE,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
        'referer': 'https://tetr.io/',
        "Content-Type": "application/json",
        "accept": "application/json"
      }
    })
    var token = authRes.data.token;
    log("authorized, getting signature");
    // step 2, get signature
    const signatureRes = await axios.get(SIGNATURE_URL, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
        'cookie': COOKIE,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
        'referrer': 'https://tetr.io/'
      },
    })
    let signature = signatureRes.data.signature;
    if (!signature) {
      return onError("Error getting signature.");
    }
    log("got signature");
    // step 3, find a valid "spool" (ws server)
    const spoolRes = await axios.get(RIBBON_SERVERS_URL, {
      headers: {
        'authorization': `Bearer ${token}`,
        'accept': 'application/json',
        'cookie': COOKIE,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
        'referer': 'https://tetr.io/'
      },
    });
    // I just pick the first one because i cba.
    const spoolURL = `wss://${spoolRes.data.spools.spools[0].host}${spoolRes.data.endpoint}`

    log("connecting to spool", spoolURL);

    var r = new Ribbon(spoolURL);
    r.SetSpoolID(spoolRes.data.spools.token);
    r.listen("open", () => {
      // on open, authorize with the token and the signature.
      r.send("server.authorize", {
        token,
        signature,
        // XXX: I don't actually know if this is necessary, might be able to delete.
        handling: { das: 1, arr: 0, sdf: 41, safelock: false, cancel: false, may20g: false },
        i: "",
      })
    })
    // When we're authorized, create the room.
    r.on('server.authorize', () => {
      r.send("room.create", false);
    });
    // When we get our first room update, that means we've joined the room!
    r.on('room.update', (d) => {
      if (joinedRoom) return;
      r.send("room.bracket.switch", "spectator");
      onCreate('https://tetr.io/#' + d.id);
      joinedRoom = true;
      roomAbandonedTimeout = setTimeout(() => {
        if (!closed) {
          r.send("room.leave", false);
          r.close();
          onAbandoned();
        }
      }, process.env.ROOM_ABANDONED_TIMEOUT);
    });
    // When someone joins the room, we'll get a join message.
    r.on('room.chat', (d) => {
      if (d.system && d.content == 'joined the room') {
        // used to need to transfer ownership first, but no need anymore you can just leave.
        // r.send("transferownership",d.user._id);
        r.send("room.leave", false);
        onPlayerJoin(d?.user?.username ?? "Someone");
        r.close();
        if (roomAbandonedTimeout !== undefined) {
          clearTimeout(roomAbandonedTimeout)
        }
      }
    });
    // after we leave, clear the room.
    r.on('room.leave', () => {
      r.close();
      if (roomAbandonedTimeout !== undefined) {
        clearTimeout(roomAbandonedTimeout)
      }
    });
    // r.onclose(() => onError(closeReason));
  } catch (e) {
    onError(e);
  }
};
