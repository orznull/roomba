/**
 * TETR.IO room creation module.
 * 
 * Probably lots of stuff that isn't actually necessary in here, I threw a lot of stuff at the wall to get this to work lol
 * Uses a dumb method where it re-logs in every single time it creates a room, so I don't have to store any tokens.
 * Every once in a while, TETR.IO ribbon codes update and everything breaks.
 * 
 * This implementation is pretty slapdash, and I recommend looking at https://gitlab.com/Zudo/autohost/ if you want a better reference on creating tetrio rooms.
 * I have no idea how out of date that repo is compared to this one, but significantly more effort has probably been put into it.
 */

import axios from "axios";
import { Ribbon } from "./ribbon.js";

import * as msgpackr from 'msgpackr';
import request from "request";
import 'dotenv/config';

// msgpackr extensions that tetrio adds.
msgpackr.addExtension({ type: 1, read: e => null === e ? { success: !0 } : { success: !0, ...e } })
msgpackr.addExtension({ type: 2, read: e => null === e ? { success: !1 } : { success: !1, error: e } });

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

		// initialize a Ribbon obj (tetrio's websocket object that auto-retries and stuff)
		var r = new Ribbon(spoolURL);
		r.setSpoolToken(spoolRes.data.spools.token);
		r.onopen(() => {
			// on open, authorize with the token and the signature.
			r.emit("authorize", {
				token,
				signature,
				// XXX: I don't actually know if this is necessary, might be able to delete.
				handling: { "arr": "0", "das": "5.4", "sdf": "21" },
				//i: v.i()
			})
		})

		// When we're authorized, create the room.
		r.on('authorize', () => {
			r.emit("room.create", false);
		});

		// When we get our first room update, that means we've joined the room!
		r.on('room.update', (d) => {
			if (joinedRoom) return;

			r.emit("room.bracket.switch", "spectator");

			onCreate('https://tetr.io/#' + d.id);
			joinedRoom = true;
			roomAbandonedTimeout = setTimeout(() => {
				if (!closed) {
					r.emit("room.leave", false);
					r.close();
					onAbandoned();
				}
			}, process.env.ROOM_ABANDONED_TIMEOUT);
		});

		// When someone joins the room, we'll get a join message.
		r.on('room.chat', (d) => {
			if (d.system && d.content == 'joined the room') {

				// used to need to transfer ownership first, but no need anymore you can just leave.
				// r.emit("transferownership",d.user._id);
				r.emit("room.leave", false);
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

		r.onclose(() => onError(closeReason));
	} catch (e) {
		onError(e);
	}

};