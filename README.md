# roomba
a discord bot that makes rooms for tetrio and jstris


# Setup

Create a `.env` file, you can copy paste `.env.template` for reference.

`npm i` to install packages.
`npm start` to run the bot. Run `:help` to see all the commands, and feel free to edit them as you wish.
```
[ :cr ] - 
:cr io to make a tetrio room. 
:cr wwc (room-setting=nlb,nlh,nlc,tlh,tlb,tlc, nlh is default) to make a wwc room. 
:cr j (or literally anything jstris is default) to make a jstris room.
The room will expire in 1 minute if nobody joins. 

[ :ping ] - Usage: :ping (message) | Ping the friendlies role with the game you want to play. 30 minute cool down (by channel). 

[ :toggleping ] - (needs manage channels perm or be bot owner) Toggle whether :ping can be used in this channel. 

[ :info ] - Info about the bot. 

[ :help ] - Displays a short description of each command. 

[ :setversion ] - (needs to be bot owner) Set Jstris version
```
