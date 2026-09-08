/*
    Graduation, the confession, and the endings (GDD section 11)
    - the good ending is nobody a stranger, both exams passed - pillar 5 says
      a goal you cannot see is not a goal, so the title screen names this one
      before week one; the whole class at friend on top of it is the best
      ending, a bonus for the year's extra challenge
    - the real ending is gated behind the good one: the last day is one
      letter to whoever is in love with you, and it only lands if the emoji
      you hand them is the best the library holds for them (ties all count)
    - nobody in love, or a letter that misses, both land the same place -
      ramen alone, and a phone full of memories
    - the end screen is the shareable wall of emoji: seed, weeks, standings
*/

'use strict';

// the epilogue tableau and its one line, in roster order (GDD 11)
const endEndings =
[
    ['🏅🌅🏟️', 'Morning runs together all summer long.'],
    ['📚☕🌧️', 'One book, two readers, a page apart.'],
    ['🎨🖼️🌸', 'You end up in every canvas.'],
    ['🎮🏆🌙', 'Two controllers, one couch.'],
    ['👑📸🛍️', 'The whole school knows by Monday.'],
    ['🌙🦇🔮', 'Watching the stars until sunrise.'],
];

const endSolo = ['🍜🌇📱', 'Ramen alone, and a phone full of memories.'];

let endWith;        // who won the letter, 0 for the solo ending
let endCandidate;   // who the tree is confessing to right now, 0 on the list

// The last day, once it has begun (GDD 11, 13), and the one thing in this game
// that cannot be taken back. 0 while the year is still being played; `[]` once
// the tree is up - or once the ending that stands in for it is, when the good
// ending was never earned; and `[who, landed]` once the letter is handed: the
// roster index of whoever it was written to, -1 for going home alone, and
// whether it found their favourite.
//
// It is saved, because without it a reload handed back the whole of week forty:
// another week of actions to lift somebody over a rung with, and another letter
// to whoever the first one had missed.
let endDone = 0;

///////////////////////////////////////////////////////////////////////////////

// what still blocks the good ending: a stranger (GDD 3, 11)
function endMissing(character) { return chatTier(character) > 3; }

// The good ending (GDD 11): nobody a stranger - all six at least an
// acquaintance - and both exams passed. It asks about all six, not just the
// one you court, and it is what opens the tree. One text a week is what set
// the bar here: friend for all six would be twenty-five of the year's forty.
function endGood()
{
    return cast().every(c => !endMissing(c)) &&
        calExamResults.length == 2 && calExamResults.every(r => r);
}

// the whole class at friend or better (GDD 11): the year's other prize, said
// at the end - and with the letter won as well, the best ending there is
function endGreat() { return cast().every(c => chatTier(c) < 3); }

// everything a letter to them could carry: owned, plus anything ever given -
// a favourite already handed over still counts (GDD 11 ✅)
function endOffers(character)
{
    return emoji => netByEmoji[emoji] && (playerOwns(emoji) ||
        playerGiven.some(g => g[0] == character.seat && g[1] == emoji));
}

// success only when the emoji scores their library ceiling - c.top, the same
// number characters.js works out for the favourite - ties all count, anything
// under it is close, but not quite, and nothing happens (GDD 3, 11)
function endLetter(emoji)
{
    return scoreTaste(emoji, endCandidate.opinions) == endCandidate.top ? endCandidate : 0;
}

///////////////////////////////////////////////////////////////////////////////

// The tree: who is in love with you, then what to hand them (GDD 11)
function endTreeHTML()
{
    if (endCandidate)
        return `<h1>${endCandidate.name}</h1>` +
            chatKeyboardHTML(endOffers(endCandidate), 'letter');

    return `<h1>Graduation</h1>
        <p style="font-size:90px;text-align:center">🌳</p>` +
        hint('the last day - one letter, one person') +

        cast().filter(c => chatTier(c) == 0).map(character =>
            tap('confess', character.idx, 'row', rowBody(
                character.avatar(56),
                `<b>${character.name}</b><p class="h l">will read your letter</p>`,
                `<b>💌</b>`))).join('') +

        button('solo', 0, '🍜 go home alone');
}

// The epilogue, then the wall of emoji you can screenshot (GDD 11). A near
// miss (endCandidate but not endWith) still names who you wrote to, so it
// never reads the same as nobody being in love at all.
function endingHTML()
{
    const who = endWith || endCandidate;
    const [tableau, line] = endWith ? endEndings[endWith.idx] :
        who ? [endEndings[who.idx][0], 'Not close enough.'] : endSolo;

    return `<h1>${who ? who.name : 'The End'}</h1>` +
        `<div class=tab>${who ?
            who.avatar(80) + '<span>💌</span>' :
            `<span>🎓</span>`}</div>` +
        `<div class=tab>${tableau}</div>` +
        hint(line) +
        (endGreat() ? hint('🎉 the whole class came to see you off' +
            (endWith ? ' - the best ending' : '')) : '') +

        hint('yearbook') + standingsHTML() +
        hint(`seed ${gameSeed} - ${calWeeks} weeks - ${playerCount()} emojis found`) +
        button('again', 0, '🔁 new school year', 'go');
}

// how everyone feels about you, and the two exams (GDD 7, 8, 9, 11)
function standingsHTML()
{
    return cast().map(c => `<div class=row>` +
        rowBody(c.avatar(44), `<b>${c.name}</b>`, chatFoot(c)) + `</div>`).join('') +
        hint(`exams: ${calExamResults.map(r => r ? '💯' : '📉').join(' ')}`);
}
