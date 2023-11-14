const fs = require("fs");
const WebSocket = require('ws');
const request = require('request');
//var msgpack = require("@msgpack/msgpack");
const msgpackr = require('msgpackr');

msgpackr.addExtension({ type: 1, read: e => null === e ? { success: !0 } : { success: !0, ...e } })
msgpackr.addExtension({ type: 2, read: e => null === e ? { success: !1 } : { success: !1, error: e } });

exports.testCreateRoom = () => {
	var buffer = fs.readFileSync('blah.txt');
	console.log(buffer);

	var unpacked = msgpackr.unpack(buffer);
	console.log(unpacked);
}

const cookie = `ceriad_exempt=1; cf_clearance=fmZJyxZs382vQThoUEHX9w8umukozhUPuu8_YTf.ZH4-1660013149-0-150`

exports.createRoom = (onUrl, onClose, onError) => {
	var sentUrl = false;
	var closed = false;
	var url = 'https://tetr.io/api/users/authenticate';
	var body = { username: 'username here', password: 'password here' };
	console.log("Attempting create tetrio room");
	request.post({
		url: url,
		json: body,
		headers: {
			'cookie': cookie,
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
			'referer': 'https://tetr.io/'
		},
	}, (error, response, body) => {
		var token = body.token;
		console.log("Got auth token")
		request({
			url: 'https://tetr.io/api/server/environment',
			headers: {
				'Authorization': `Bearer ${token}`,
				'accept': 'application/vnd.osk.theorypack',
				'cookie': cookie,
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
				'referer': 'https://tetr.io/'
			},
			encoding: null
		},

			(err, res, b) => {
				try {
					var obj = msgpackr.unpack(b);
				} catch (e) {
					console.log(e);
					return onError();
				}
				var signature = obj.signature;
				console.log("Got signature");
				request({
					url: 'https://tetr.io/api/server/ribbon',
					headers: {
						'authorization': `Bearer ${token}`,
						'accept': 'application/vnd.osk.theorypack',
						'cookie': cookie,
						'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
						'referer': 'https://tetr.io/'
					},
					encoding: null
				},
					(err2, res2, b2) => {
						try {
							var endpointObj = msgpackr.unpack(b2);
						} catch (e) {
							console.log(e);
							return onError();
						}
						//console.log(JSON.stringify(endpointObj));
						//console.log(`wss://${endpointObj.spools.spools[0].host}${endpointObj.endpoint}`);
						//console.log(endpointObj.spools.token);
						console.log("Connecting to spool");
						var r = new Ribbon(`wss://${endpointObj.spools.spools[0].host}${endpointObj.endpoint}`);
						r.setSpoolToken(endpointObj.spools.token);
						r.onopen(() => {
							console.log("Ribbon opened.");
							r.emit("authorize", {
								token: token,
								handling: { "arr": "0", "das": "5.4", "sdf": "21" },
								signature: signature,
								//i: v.i()
							})
						})

						r.on('authorize', () => {
							console.log("Ribbon authorized");

							r.emit("room.create", "private");
						});
						r.on('room.update', (d) => {
							if (sentUrl) return;
							console.log("Entered room.");
							r.emit("room.bracket.switch", "spectator");

							onUrl('https://tetr.io/#' + d.id);
							sentUrl = true;

							setTimeout(() => {
								if (!closed) {
									//console.log(r);
									//console.log(r.isAlive());
									r.emit("room.leave", false);
									r.close();
									onClose(false);
								}
							}, 60 * 1000);
						});

						r.on('room.chat', (d) => {
							if (d.system && d.content == 'joined the room') {
								//r.emit("transferownership",d.user._id);

								r.emit("room.leave", false);
								onClose(true);
								r.close();
								closed = true;
							}
						});


						r.on('room.leave', () => {
							r.close();
						});
					});
			})
	});
}

//exports.createRoom(()=>{}, ()=>{});

function toArrayBuffer(buf) {
	var ab = new ArrayBuffer(buf.length);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buf.length; ++i) {
		view[i] = buf[i];
	}
	return ab;
}

const RIBBON_CLOSE_CODES = {
	'1000': 'ribbon closed normally',
	'1001': 'client closed ribbon',
	'1002': 'protocol error',
	'1003': 'protocol violation',
	'1006': 'ribbon lost',
	'1007': 'payload data corrupted',
	'1008': 'protocol violation',
	'1009': 'too much data',
	'1010': 'negotiation error',
	'1011': 'server error',
	'1012': 'server restarting',
	'1013': 'temporary error',
	'1014': 'bad gateway',
	'1015': 'TLS error'
};
const RIBBON_BATCH_TIMEOUT = 25;
const RIBBON_CACHE_EVICTION_TIME = 25000;

const RIBBON_EXTRACTED_ID_TAG = new Uint8Array([174]);
const RIBBON_STANDARD_ID_TAG = new Uint8Array([69]);
const RIBBON_BATCH_TAG = new Uint8Array([88]);
const RIBBON_EXTENSION_TAG = new Uint8Array([0xB0]);

const RIBBON_EXTENSIONS = new Map();
RIBBON_EXTENSIONS.set(0x0B, (payload) => {
	if (payload.byteLength >= 6) {
		return { command: 'ping', at: new DataView(payload.buffer).getUint32(2, false) };
	} else {
		return { command: 'ping' };
	}

});
RIBBON_EXTENSIONS.set('PING', (extensionData) => {
	if (typeof extensionData === 'number') {
		const dat = new Uint8Array([0xB0, 0x0B, 0x00, 0x00, 0x00, 0x00]);
		new DataView(dat.buffer).setUint32(2, extensionData, false);
		return dat;
	} else {
		return new Uint8Array([0xB0, 0x0B]);
	}
});
RIBBON_EXTENSIONS.set(0x0C, (payload) => {
	if (payload.byteLength >= 6) {
		return { command: 'pong', at: new DataView(payload.buffer).getUint32(2, false) };
	} else {
		return { command: 'pong' };
	}
});
RIBBON_EXTENSIONS.set('PONG', (extensionData) => {
	if (typeof extensionData === 'number') {
		const dat = new Uint8Array([0xB0, 0x0C, 0x00, 0x00, 0x00, 0x00]);
		new DataView(dat.buffer).setUint32(2, extensionData, false);
		return dat;
	} else {
		return new Uint8Array([0xB0, 0x0C]);
	}
});

const globalRibbonPackr = new msgpackr.Packr({
	bundleStrings: true
});
const globalRibbonUnpackr = new msgpackr.Unpackr({
	bundleStrings: true
});


// Ribbon - blazing-fast, msgpacked resumeable WebSockets 
const Ribbon = function (uri) {
	let endpoint = uri;
	let spoolToken = undefined;
	let ws = null;
	let id = null;
	let resume = null;
	let lastSentId = 0;
	let lastReceivedId = 0;
	let lastSent = [];
	let lastSentTimes = [];
	let alive = true;
	let closeReason = 'ribbon lost';
	let messageListeners = {};
	let openListeners = [];
	let closeListeners = [];
	let pongListeners = [];
	let resumeListeners = [];
	let reconnectStartListeners = [];
	let saveListeners = [];
	let pingInterval = null;
	let lastPing = 0;
	let mayReconnect = true;
	let dead = false;
	let ignoreCleanness = false;
	let pingissues = false;
	let wasEverConnected = false;
	let incomingQueue = [];
	let switchingEndpoint = false;
	let batchQueue = [];
	let batchTimeout = null;
	let cacheSize = 200;
	let reconnecting = false;
	let lastCacheReping = Date.now();
	let fasterPingRequirement = false;
	let pingID = 0;
	let reconnectTimeout = null;

	pingInterval = setInterval(() => {
		pingID++;
		if (!fasterPingRequirement && (pingID % 2) !== 0) {
			return;
		}

		if (!alive) {
			// we're pinging out, get our ass a new connection
			pingissues = true;
			console.warn('Ping timeout in ribbon. Abandoning current socket and obtaining a new one...');
			closeReason = 'ping timeout';
			Reconnect();
		}
		alive = false;
		if (ws && ws.readyState === 1) {
			lastPing = Date.now();
			try {
				if (ws.readyState === 1) {
					ws.send(SmartEncode('PING', null, lastReceivedId));
				}
			} catch (ex) { }
		}

		// It's a bit cheeky to do this here, but it's fine. If we already have an interval, why create another one?
		while (lastSentTimes.length && (Date.now() - lastSentTimes[0]) >= RIBBON_CACHE_EVICTION_TIME) {
			lastSent.shift();
			lastSentTimes.shift();
		}
	}, 2500);

	function SmartEncode(packet, packr = null, extensionData = null) {
		if (typeof packet === 'string') {
			// This might be an extension, look it up
			const found = RIBBON_EXTENSIONS.get(packet);
			if (found) {
				return found(extensionData);
			}
		}

		let prependable = RIBBON_STANDARD_ID_TAG;

		const msgpacked = (packr || globalRibbonPackr).pack(packet);
		const merged = new Uint8Array(prependable.length + msgpacked.length);
		merged.set(prependable, 0);
		merged.set(msgpacked, prependable.length);

		return merged;
	}

	function SmartDecode(packet, unpackrchain = []) {
		if (packet[0] === RIBBON_EXTENSION_TAG[0]) {
			// look up this extension
			const found = RIBBON_EXTENSIONS.get(packet[1]);
			if (!found) {
				console.error(`Unknown Ribbon extension ${packet[1]}!`);
				console.error(packet);
				throw 'Unknown extension';
			}
			return found(packet);
		} else if (packet[0] === RIBBON_STANDARD_ID_TAG[0]) {
			// simply extract
			return UnpackInner(packet.slice(1), unpackrchain, false);
		} else if (packet[0] === RIBBON_EXTRACTED_ID_TAG[0]) {
			// extract id and msgpacked, then inject id back in
			// these don't support sequential, hence why we try the global first!	
			const object = UnpackInner(packet.slice(5), unpackrchain, true);
			const view = new DataView(packet.buffer);
			const id = view.getUint32(1, false);
			object.id = id;

			return object;
		} else if (packet[0] === RIBBON_BATCH_TAG[0]) {
			// ok these are complex, keep looking through the header until you get to the (uint32)0 delimiter
			const items = [];
			const lengths = [];
			const view = new DataView(packet.buffer);

			// Get the lengths
			for (let i = 0; true; i++) {
				const length = view.getUint32(1 + (i * 4), false);
				if (length === 0) {
					// We've hit the end of the batch
					break;
				}
				lengths.push(length);
			}

			// Get the items at those lengths
			let pointer = 0;
			for (let i = 0; i < lengths.length; i++) {
				items.push(packet.slice(1 + (lengths.length * 4) + 4 + pointer, 1 + (lengths.length * 4) + 4 + pointer + lengths[i]));
				pointer += lengths[i];
			}

			return { command: 'X-MUL', items: items.map(o => SmartDecode(o, unpackrchain)) };
		} else {
			// try just parsing it straight?	
			return UnpackInner(packet, unpackrchain, false);
		}
	}


	function UnpackInner(packet, unpackrchain, reverseOrder) {
		unpackrchain = [...unpackrchain];
		while (unpackrchain.length) {
			try {
				return (reverseOrder ? unpackrchain.shift() : unpackrchain.pop()).unpack(packet);
			} catch (e) {
				if (!unpackrchain.length) {
					throw e;
				}
			}
		}
	}

	function Open() {
		if (ws) {
			// Discard the old socket entirely
			ws.onopen = () => { };
			ws.onmessage = () => { };
			ws.onerror = () => { };
			ws.onclose = () => { };
			ws.close();
		}

		ws = new WebSocket(endpoint, spoolToken);
		incomingQueue = [];
		ws.packr = new msgpackr.Packr({
			bundleStrings: true,
			sequential: true
		});
		ws.unpackr = new msgpackr.Unpackr({
			bundleStrings: true,
			sequential: true, // this doesn't really do anything, we just use it so we can know if we're using a sequential unpackr
		});

		ws.onclose = (e) => {
			ignoreCleanness = false;
			if (RIBBON_CLOSE_CODES[e.code]) {
				closeReason = RIBBON_CLOSE_CODES[e.code];
			}
			if (closeReason === 'ribbon lost' && pingissues) {
				closeReason = 'ping timeout';
			}
			if (closeReason === 'ribbon lost' && !wasEverConnected) {
				closeReason = 'failed to connect';
			}
			console.log(`Ribbon ${id} closed (${closeReason})`);
			Reconnect();
		};
		ws.onopen = (e) => {
			wasEverConnected = true;
			if (resume) {
				console.log(`Ribbon ${id} resuming`);
				ws.send(SmartEncode({ command: 'resume', socketid: id, resumetoken: resume }, ws.packr));
			} else {
				ws.send(SmartEncode({ command: 'new' }, ws.packr));
			}
		};
		ws.onmessage = (e) => {
			try {
				var ab = toArrayBuffer(e.data);
				const msg = SmartDecode(new Uint8Array(ab), [globalRibbonUnpackr, ws.unpackr]);

				if (msg.command === 'kick') {
					mayReconnect = false;
				}

				if (msg.command === 'nope') {
					console.error(`Ribbon ${id} noped out (${msg.reason})`);
					mayReconnect = false;
					closeReason = msg.reason;
					Close();
				} else if (msg.command === 'hello') {
					reconnecting = false;
					id = msg.id;
					console.log(`Ribbon ${id} ${resume ? 'resumed' : 'opened'}`);
					if (resume) {
						ws.send(SmartEncode({ command: 'hello', packets: lastSent }, ws.packr));
					}
					resume = msg.resume;
					alive = true;
					msg.packets.forEach((p) => {
						HandleMessage(p);
					});
					openListeners.forEach((l) => {
						l();
					});
					saveListeners.forEach((l) => {
						l();
					});
				} else if (msg.command === 'pong') {
					alive = true;
					pingissues = false;
					pongListeners.forEach((l) => {
						l(Date.now() - lastPing);
					});
					if (msg.at) {
						// we can evict anything lower from our to-be-sent
						while (lastSent.length && lastSent[0].id <= msg.at) {
							lastSent.shift();
							lastSentTimes.shift();
						}
					}
				} else if (msg.command === 'X-MUL') {
					msg.items.forEach((m) => {
						HandleMessage(m);
					});
				} else {
					HandleMessage(msg);
				}
			} catch (ex) {
				console.error('Failed to parse message', ex);
			}
		};
		ws.onerror = (e) => {
			if (!wasEverConnected) {
				if (messageListeners['connect_error']) {
					messageListeners['connect_error'].forEach((l) => {
						l();
					});
				}
			}
			console.log(e);
		};
		alive = true;
	}

	function HandleMessage(msg) {
		if (msg.id) {
			if (msg.id <= lastReceivedId) {
				return; // already seen this
			}

			EnqueueMessage(msg);
			return;
		}

		if (messageListeners[msg.command]) {
			messageListeners[msg.command].forEach((l) => {
				l(msg.data);
			});
		}
	}

	function EnqueueMessage(msg) {
		if (msg.id === lastReceivedId + 1) {
			// we're in order, all good!
			if (messageListeners[msg.command]) {
				messageListeners[msg.command].forEach((l) => {
					l(msg.data);
				});
			}
			lastReceivedId = msg.id;
		} else {
			incomingQueue.push(msg);
		}

		if (incomingQueue.length) {
			// Try to go through these
			incomingQueue.sort((a, b) => {
				return a.id - b.id;
			});

			while (incomingQueue.length) {
				const trackbackMessage = incomingQueue[0];

				if (trackbackMessage.id !== lastReceivedId + 1) {
					// no good, wait longer
					break;
				}

				// cool, let's push it
				incomingQueue.shift();
				if (messageListeners[trackbackMessage.command]) {
					messageListeners[trackbackMessage.command].forEach((l) => {
						l(trackbackMessage.data);
					});
				}
				lastReceivedId = trackbackMessage.id;
			}
		}
		if (incomingQueue.length > 5200) {
			console.error(`Ribbon ${id} unrecoverable: ${incomingQueue.length} packets out of order`);
			closeReason = 'too many lost packets';
			Close();
			return;
		}
	}

	function Send(command, data, batched = false) {
		const packet = { id: ++lastSentId, command, data };
		lastSent.push(packet);
		lastSentTimes.push(Date.now());
		if (reconnecting) { return; }

		if ((lastSentId % 100) === 0) {
			// recalculate how large our cache should be
			const packetsPerSecond = 1000 / ((Date.now() - lastCacheReping) / 100);
			cacheSize = Math.max(100, Math.min(30 * packetsPerSecond, 2000));
			lastCacheReping = Date.now();
		}

		while (lastSent.length > cacheSize) {
			lastSent.shift();
			lastSentTimes.shift();
		}

		while (lastSentTimes.length && (Date.now() - lastSentTimes[0]) >= RIBBON_CACHE_EVICTION_TIME) {
			lastSent.shift();
			lastSentTimes.shift();
		}

		if (batched) {
			batchQueue.push(SmartEncode(packet, ws ? ws.packr : null));

			if (!batchTimeout) {
				batchTimeout = setTimeout(FlushBatch, RIBBON_BATCH_TIMEOUT);
			}
			return;
		} else {
			FlushBatch();
		}

		try {
			if (ws.readyState === 1) {
				ws.send(SmartEncode(packet, ws.packr));
			}
		} catch (ex) { }
	}

	function FlushBatch() {
		if (!batchQueue.length) { return; }
		if (reconnecting) { return; }

		if (batchTimeout) {
			clearTimeout(batchTimeout);
			batchTimeout = null;
		}

		// If our batch is only 1 long we really dont need to go through this painful process
		if (batchQueue.length === 1) {
			try {
				if (ws.readyState === 1) {
					ws.send(batchQueue[0]);
				}
			} catch (ex) { }

			batchQueue = [];
			return;
		}

		// Get the total size of our payload, so we can prepare a buffer for it
		let totalSize = batchQueue.reduce((a, c) => { return a + c.length; }, 0);
		const buffer = new Uint8Array(1 + (batchQueue.length * 4) + 4 + totalSize);
		const view = new DataView(buffer.buffer);

		// Set the tag
		buffer.set(RIBBON_BATCH_TAG, 0);

		// Set the lengths and data blocks
		let pointer = 0;

		for (let i = 0; i < batchQueue.length; i++) {
			// Set the length
			view.setUint32(1 + (i * 4), batchQueue[i].length, false);

			// Set the data
			buffer.set(batchQueue[i], 1 + (batchQueue.length * 4) + 4 + pointer);
			pointer += batchQueue[i].length;
		}

		// Batch ready to send!
		try {
			if (ws.readyState === 1) {
				ws.send(buffer);
			}
		} catch (ex) { }

		batchQueue = [];
	}

	function Close(reason = null, silent = false) {
		mayReconnect = false;
		if (reason) {
			closeReason = reason;
		}
		if (ws) {
			ws.onclose = () => { };
			try {
				if (ws.readyState === 1) {
					ws.send(SmartEncode({ command: 'die' }, ws.packr));
				}
				ws.close();
			} catch (ex) { }
		}

		Die(silent);
	}

	function Cut(penalty = 0) {
		ignoreCleanness = true;
		extraPenalty = penalty;
		if (ws) {
			ws.close();
		}
	}

	function SwitchEndpoint() {
		console.warn(`Ribbon ${id} changing endpoint (new endpoint: ${endpoint})`);
		ignoreCleanness = true;
		switchingEndpoint = true;
		if (ws) {
			ws.close();
		}

		setTimeout(ExpediteReconnect, 5);
	}

	let reconnectCount = 0;
	let lastReconnect = 0;
	let extraPenalty = 0;

	function Reconnect() {
		reconnecting = true;

		if (!switchingEndpoint) {
			if ((Date.now() - lastReconnect) > 40000) {
				reconnectCount = 0;
			}
			lastReconnect = Date.now();

			if (reconnectCount >= 10 || !mayReconnect) {
				// Stop bothering
				console.error(`Ribbon ${id} abandoned: ${mayReconnect ? 'too many reconnects' : 'may not reconnect'}`);
				Die();
				return;
			}

			console.warn(`Ribbon ${id} reconnecting in ${extraPenalty + 5 + 100 * reconnectCount}ms (reconnects: ${reconnectCount + 1})`);
			resumeListeners.forEach((l) => {
				l(extraPenalty + 5 + 100 * reconnectCount);
			});
		}

		if (reconnectTimeout) { clearTimeout(reconnectTimeout); }
		reconnectTimeout = setTimeout(() => {
			reconnectTimeout = null;
			if (dead) {
				console.log(`Canceling reopen of ${id}: no longer needed`);
				return;
			}

			reconnectStartListeners.forEach((l) => { l(); });

			Open();
		}, switchingEndpoint ? 0 : (extraPenalty + 5 + 100 * reconnectCount));

		if (switchingEndpoint) {
			switchingEndpoint = false;
		} else {
			reconnectCount++;
			extraPenalty = 0;
		}
	}

	function ExpediteReconnect() {
		if (!reconnectTimeout) { return; }
		clearTimeout(reconnectTimeout);

		reconnectTimeout = null;
		if (dead) {
			console.log(`Canceling reopen of ${id}: no longer needed`);
			return;
		}

		reconnectStartListeners.forEach((l) => { l(); });

		Open();
		switchingEndpoint = false;
	}

	function Die(silent = false) {
		if (dead) { return; }
		console.log(`Ribbon ${id} dead (${closeReason})`);
		dead = true;
		mayReconnect = false;

		if (!silent) {
			closeListeners.forEach((l) => {
				l(closeReason);
			});
		}

		if (ws) {
			ws.onopen = () => { };
			ws.onmessage = () => { };
			ws.onerror = () => { };
			ws.onclose = () => { };
		}

		clearInterval(pingInterval);
	}


	// Publics
	return {
		getEndpoint: () => {
			return endpoint;
		},
		setEndpoint: (uri) => {
			endpoint = uri;
		},
		getSpoolToken: () => {
			return spoolToken;
		},
		setSpoolToken: (uri) => {
			spoolToken = uri;
		},
		getId: () => { return id; },
		open: Open,
		isAlive: () => { return alive; },
		close: Close,
		send: Send,
		emit: Send,
		onclose: (l) => { closeListeners.push(l); },
		onopen: (l) => { openListeners.push(l); },
		onpong: (l) => { pongListeners.push(l); },
		onresume: (l) => { resumeListeners.push(l); },
		onreconnectstart: (l) => { reconnectStartListeners.push(l); },
		onsave: (l) => { saveListeners.push(l); },
		on: (type, l) => {
			if (messageListeners[type]) {
				messageListeners[type].push(l);
			} else {
				messageListeners[type] = [l];
			}
		},
		off: (type, l) => {
			if (messageListeners[type]) {
				if (!l) {
					messageListeners[type] = [];
					return;
				} else {
					messageListeners[type] = messageListeners[type].filter(o => o !== l);
				}
			}
		},
		cut: Cut,
		switchEndpoint: SwitchEndpoint,
		setFasterPingRequirement: (nv) => { fasterPingRequirement = nv; }
	};
}


