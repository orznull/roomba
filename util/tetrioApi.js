import axios from "axios";
import { TETRIO_USERS_KEY } from "../commands/linkTetrio.js";
import { getVal } from "../modules/storage.js";

const axiosHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
};

export const fetchTetrioUserInfo = async (user) => {
  try {
    const res = await axios.get(`https://ch.tetr.io/api/users/${user}`, { headers: axiosHeaders });
    return { user: res.data?.data, error: undefined };
  } catch (e) {
    return { user: undefined, error: `\`[TETR.IO API Error]\` ${e.response?.data?.error.msg ?? "Connection Error"}` };
  }

}

export const fetchTetraLeagueSummary = async (user) => {
  try {
    const res = await axios.get(`https://ch.tetr.io/api/users/${user}/summaries/league`, { headers: axiosHeaders });
    return { user: res.data?.data, error: undefined };
  } catch (e) {
    return { user: undefined, error: `\`[TETR.IO API Error]\` ${e.response?.data?.error.msg ?? "Connection Error"}` };
  }
}

export const getTetrioStatsFromLinkedDiscord = async (discordUserID) => {
  const linkedTetrioUsers = getVal(TETRIO_USERS_KEY, {});
  const ioUsername = linkedTetrioUsers[discordUserID];
  if (!ioUsername) return "";
  const { user, error } = await fetchTetraLeagueSummary(ioUsername);
  if (error) return `[**${ioUsername}**](https://ch.tetr.io/u/${ioUsername}) - ${error}`
  return `[**${ioUsername}**](https://ch.tetr.io/u/${ioUsername})\n`
    + `**TL Rating:** ${user.tr.toFixed(2)}, ${user.percentile_rank?.toUpperCase?.()} Rank, #${user.standing} \n`
    + `**Glicko:** ${user.glicko.toFixed(2)} ± ${user.rd.toFixed(2)}\n`
}
