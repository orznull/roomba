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

const __signature = {
  version: "1.3.1",
  countdown: !1,
  novault: !1,
  noceriad: !1,
  norichpresence: !1,
  noreplaydispute: !1,
  supporter_specialthanks_goal: 200,
  xp_multiplier: 1,
  catalog: {
    supporter: {
      price: 5,
      price_bulk: 4,
      price_gift: 4,
      price_gift_bulk: 4,
      bulk_after: 3,
      normal_price: 5,
      normal_price_bulk: 4,
      normal_price_gift: 4,
      normal_price_gift_bulk: 4,
      normal_bulk_after: 3
    }
  },
  league_mm_roundtime_min: 25,
  league_mm_roundtime_max: 50,
  league_additional_settings: {},
  league_season: {
    current: "2",
    prev: "1",
    next: null,
    next_at: null,
    ranked: !0
  },
  zenith_duoisfree: !1,
  zenith_additional_settings: {
    TEMP_zenith_grace: "[0, 3.8, 3.0, 2.3, 1.7, 1.2, 0.8, 0.5, 0.5, 0.5, 0.2]"
  },
  domain: "tetr.io",
  domain_hash: "bbbb17404b72eb5f9fba02d3074dbe7089b461ad",
  ch_domain: "ch.tetr.io",
  mode: "production",
  commit: {
    id: "2a619dc4",
    time: 1730679313e3
  },
  branch: "master",
  serverCycle: "a9e7f86acc1e",
  build: {
    id: "06407c3f399305",
    time: 1732114259579
  },
  sentry_enabled: !0
}

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
        signature: __signature,
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
