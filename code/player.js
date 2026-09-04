/*
    The player's keyboard (GDD sections 3, 4, 5, 7, 9, 11)
    - your collection IS your stat block: what you own is what you can say
    - taste emoji are earned from weekday activities, faces you start with
    - a gift is permanent: it leaves the keyboard and the record stays forever
*/

'use strict';

// tone emoji, everyone starts with these - they carry tone, never taste (GDD 9)
const playerFaces = ['🙂','😍','❓'];

// emoji -> 1, owned. Missing means not owned.
let playerKeyboard = {};

// seat -> emoji -> staleness counter, for copy paste detection (GDD 4)
let playerSent = {};

// [seat, emoji, week] per gift given, permanent even after it leaves the keyboard
let playerGiven = [];

///////////////////////////////////////////////////////////////////////////////

function initPlayer()
{
    playerKeyboard = {};
    playerSent = {};
    playerGiven = [];
    for (const f of playerFaces) playerKeyboard[f] = 1;
}

// one emoji from each club, drawn from the seed (GDD 7)
function playerStart()
{
    for (const club of netClubs)
        playerUnlock(netPick(netClub(club)).e);
}

function playerUnlock(emoji) { playerKeyboard[emoji] = 1; }
function playerOwns(emoji) { return playerKeyboard[emoji] != undefined; }

// how much of the library you learned, the number the end screen brags about
function playerCount() { return Object.keys(playerKeyboard).length - playerFaces.length; }

// Three offers out of a pool, rotated by a spin that is stable for the week,
// so leaving a page and coming back cannot reroll them. What a club teaches
// (calendar.js, activityChoices) and what a place sends you home with
// (date.js, dateTrip) are the same draw off two different shelves, and were
// two copies of this until the size pass. Anything already owned drops out -
// except the one just kept, which stays on the shelf until Monday so the page
// can show what was taken among what was not.
function playerOffers(pool, spin, keep = 0)
{
    return pool.map((emoji, i) => pool[(i + spin) % pool.length])
        .filter(emoji => !playerOwns(emoji) || emoji == keep).slice(0, 3);
}

// Staleness (GDD 4) 📏: a send adds this to an emoji's counter, a week takes
// one off, and the penalty caps at 3.
//
// A message of ONE emoji with no face adds one instead of two - saying a
// single thing plainly does not wear out the way a pair does. That is the
// whole of what the bare single emoji has going for it, and it needed
// something: two emoji buy two tapbacks, 😍 doubles, 🙂 hedges and ❓ asks,
// which left one emoji on its own as the only shape with no reason to pick it.
//
// A FACE COSTS THE FULL TWO, deliberately. 😍 on one emoji is already the
// highest-scoring move in the game when you know what you are doing, and a
// discount on the same message would have made the strongest play stronger
// instead of giving the weakest one a job.
function playerNote(seat, emoji, said = 2)
{
    const mine = playerSent[seat] || (playerSent[seat] = {});
    mine[emoji] = (mine[emoji] || 0) + said;
}
function playerStale(seat, emoji)
{
    return min(3, (playerSent[seat] || {})[emoji] || 0);
}
function playerDecay()
{
    for (const seat in playerSent)
        for (const e in playerSent[seat])
            playerSent[seat][e] = max(0, playerSent[seat][e] - 1);
}

// a gift is permanent: the emoji leaves, the record stays (GDD 9, 11)
function playerGive(seat, emoji, week)
{
    delete playerKeyboard[emoji];
    playerGiven.push([seat, emoji, week]);
}
