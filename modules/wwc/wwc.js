/**
 * WWC module, this is the only one with an official room creating API! 
 * I'm pretty sure this is just broken because the api is broken.
 * Might be my fault, but nobody really plays wwc any pensive
 * Can't join rooms with current api
 */

import axios from "axios";

export const createWWCRoom = async ({ roomType, onCreate, onError }) => {
  try {
    // this should not be a get request but it is. society
    var res = await axios.get(`https://www.worldwide-combos.com/api/roomba?rs=${roomType}`);
    onCreate(`https://www.worldwide-combos.com/custom?c=${res.data.code}`)
  } catch (e) {
    onError()
  }
}