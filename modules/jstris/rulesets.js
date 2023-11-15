const mcdt = {
  "t": 11,
  "p": true,
  "n": "MCDT room",
  "pl": 4,
  "m": 2,
  "at": [
    0,
    0,
    1,
    2,
    4,
    4,
    6,
    2,
    0,
    4,
    2
  ],
  "ct": [
    0,
    0,
    1,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    4,
    0
  ],
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
  "ld": [
    500,
    5000,
    20000
  ],
  "sgpA": [
    0,
    3
  ],
  "ext": 2
};

const defaultRuleset = { // Make room request
  as: 0,
  at: [0, 0, 1, 2, 4, 4, 6, 2, 0, 10, 1],
  bset: 0,
  cd: 0,
  ct: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
  gDelay: 500,
  gInv: false,
  gapW: 1,
  gblock: 0,
  gdm: 3,
  grav: 1,
  hold: true,
  hostStart: false,
  ld: [500, 5000, 20000],
  m: 0,
  mess: 0,
  n: "Roomba Room", // name
  noFW: false,
  p: true, // private room
  pl: 2, // number of players
  pr: 5,
  rnd: 0,
  sa: false,
  sg: 120,
  sl: 0,
  srv: "0",
  t: 11
}


export default {
  mcdt,
  default: defaultRuleset,
}