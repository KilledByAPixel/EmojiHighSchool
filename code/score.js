'use strict';

// Scoring core: distance between emoji and attributes, taste opinions, overlap
// matching, and the reply face ladder (GDD 3, 4, and the face scale)

const SCORE_INF = 99;

// distance from an emoji to one attribute word (GDD 3): exact 0; colour is
// neighbour-or-nothing; club and tag are hit or miss
function scoreDist(rec, word)
{
    const kind = netAttrKind(word);
    if (kind == 0) return rec.club == word ? 0 : SCORE_INF;
    if (kind == 3) return rec.tags.includes(word) ? 0 : SCORE_INF;
    if (kind == 1) return rec.colour == word ? 0 :
        netIsNear(word, rec.colour) ? 1 : SCORE_INF;
    return SCORE_INF;
}

// taste = for each opinion, its strength less how far away the emoji is
function scoreTaste(emoji, opinions)
{
    const rec = netByEmoji[emoji];
    return opinions.reduce((n, [word, w]) =>
        n + Math.sign(w)*max(0, abs(w) - scoreDist(rec, word)), 0);
}

// How much one emoji answers a list of attribute words (GDD 4) 📏: one point
// a word it carries exactly, club colour size and tag alike. This used to pay
// 2 for an exact colour or size and 1 for a near one, and test/sim.mjs said
// that made answering them worth more than knowing them - the emoji a player
// picked on overlap alone carried a taste of 2 against a worked-out pick's 3,
// and a player who knew nothing finished the year within 2% of one who knew
// the public love (587 against 596) and 18% behind one who knew everything
// (718). Overlap is public and taste has to be deduced, so overlap now runs
// 0 to about 5 and a strong opinion runs to 6.
function scoreOverlapAttrs(emoji, words)
{
    const rec = netByEmoji[emoji];
    return words.reduce((n, word) => n + (scoreDist(rec, word) == 0), 0);
}

// how much one emoji answers another: its whole profile as the word list
function scoreOverlap(emojiA, emojiB)
{
    const b = netByEmoji[emojiB];
    return scoreOverlapAttrs(emojiA, [b.club, b.colour, ...b.tags]);
}

// What one point of taste is worth against one point of overlap (GDD 4) 📏.
// Taste is the half of a message the player has to deduce and overlap is the
// half anybody can read off the screen, so this is the dial GDD 4 calls the
// one that decides whether the game is a conversation or a quiz. It weighs
// the taste side of a send and of a date beat - never the per emoji tapback,
// which stays raw, because that is the fact the player is collecting.
//
// Two is the largest weight that leaves the three knowledge levels in order.
// At three, a player holding only the public love - the free word at the
// time - finished level with one holding nothing (727 against 726 over 60
// seeded years), because the +1 was the weakest of the five opinions and
// chasing it cost a point of overlap that would have paid the same.
const SCORE_TASTE_WEIGHT = 2;

// The reply face ladder (GDD 4) 📏. Set against real send totals out of
// test/sim.mjs: a worked-out player's text runs 12 to 24 and lands on 18 or
// 20 as often as not, so 😍 there fired on half of them when the bands were
// set - 70% now, with mood at a quarter, on 45% for a player going by the
// role's word and 21% for one going by nothing (GDD 15). The bands
// mirror either side of zero, four wide and then six, and anything below zero is
// visibly below zero, because a bad guess is the other half of what the
// player is here to read.
//
// A table rather than a ternary chain, the same shape as the tapback steps
// (chat.js, chatTapbacks), so a threshold is one number in one place.
const scoreFaces =
[
    [  20, '😍'],
    [  10, '😊'],
    [   4, '🙂'],
    [   0, '😐'],
    [  -4, '😕'],
    [ -10, '😠'],
    [-1e9, '😡'],
];

function scoreFace(score)
{
    return scoreFaces.find(([threshold]) => score >= threshold)[1];
}

// validation floors (GDD 3) - measured Aug 2026: ~64% of rolls pass
const SCORE_BEST_FLOOR = 4, SCORE_SPREAD = 4, SCORE_GOOD = 3;

function scoreValidate(opinions)
{
    const hated = opinions.filter(([, w]) => w < 0).map(([a]) => a);
    const rated = netLib.map(r => scoreTaste(r.e, opinions));
    const best = max(...rated);
    const bestRec = netLib[rated.indexOf(best)];
    return best >= SCORE_BEST_FLOOR &&
        !hated.some(a => scoreDist(bestRec, a) == 0) &&
        rated.filter(t => t >= SCORE_GOOD).length >= SCORE_SPREAD &&
        rated.filter(t => t <= -SCORE_GOOD).length >= SCORE_SPREAD;
}

// Five ranked opinions, re-rolled until the puzzle is worth
// solving (GDD 3). The role's own word is guaranteed one of the two strongest
// loves - the +3 or the +2, a coin's choice - so "the gamer" never lies about
// games, and never says which rung it sits on either. An empty word rolls
// all five free.
function scoreRollOpinions(word)
{
    const pool = netAttrs.filter(a => a != word);
    while (1)
    {
        const chosen = [], at = netRandInt(2);
        while (chosen.length < 5)
        {
            const a = word && chosen.length == at ? word : netPick(pool);
            chosen.includes(a) || chosen.push(a);
        }
        const ops = chosen.map((a, i) => [a, [3, 2, 1, -3, -2][i]]);
        if (scoreValidate(ops)) return ops;
    }
}

// what they open with: a weighted draw from what they like, biased toward the
// higher scores but never simply their best. The known/new coin keeps replies
// from teaching too quickly while still making a new emoji an ordinary thing
// to receive (GDD 5).
function scorePrompt(opinions, avoid = '', split = false)
{
    if (!split)
    {
        const pool = [];
        for (const r of netLib)
        {
            if (r.e == avoid)
                continue;
            const t = scoreTaste(r.e, opinions);
            for (let i = 1; i < t; ++i) pool.push(r.e);
        }
        return pool.length ? netPick(pool) : avoid || netPick(netLib).e;
    }

    const known = [], fresh = [];
    for (const r of netLib)
    {
        if (r.e == avoid)
            continue;
        const t = scoreTaste(r.e, opinions);
        const owned = typeof playerOwns == 'function' && playerOwns(r.e);
        for (let i = 1; i < t; ++i)
            (owned ? known : fresh).push(r.e);
    }
    if (!known.length && !fresh.length)
        return avoid || netPick(netLib).e;
    const pool = known.length && fresh.length ?
        netPick([known, fresh]) : known.length ? known : fresh;
    return netPick(pool);
}

// the order the question mark gives their opinions up in (GDD 5): strongest
// first, love and hate alike - and never the role's own word, which the row
// already gives away, so an ask never sells what you were already told
function scoreLadder(c)
{
    return c.opinions.filter(([a]) => a != c.word).sort((x, y) => abs(y[1]) - abs(x[1]));
}
