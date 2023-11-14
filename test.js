
const msgpackr = require('msgpackr');

msgpackr.addExtension({type:1,read:e=>null===e?{success:!0}:{success:!0,...e}})
msgpackr.addExtension({type:2,read:e=>null===e?{success:!1}:{success:!1,error:e}});


function _base64ToByteArray(base64) {
    var binary_string = atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
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

function SmartDecode(packet, unpackrchain = []) {
		if (packet[0] === RIBBON_EXTENSION_TAG[0]) {
			// look up this extension
			const found = RIBBON_EXTENSIONS.get(packet[1]);
			if (!found) {
				console.error(`Unknown Ribbon extension ${ packet[1] }!`);
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

/*
var fs = require('fs');
var buffer = fs.readFileSync('blah.txt');
console.log(buffer);


var unpacked = msgpackr.unpack(buffer);
console.log(unpacked);
*/

//tetrio.testCreateRoom();
//tetrio.createRoom(url => console.log, () => {});