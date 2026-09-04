/*
    The cast (GDD section 7)
    - the archetypes are fixed so they stay readable: their role, the word it
      guarantees, and what their quirk does - keyed on the index each one
      sits at in characters, never on a word, because no quirk is printed
    - everything else comes out of the seed: the other four opinions, what
      they look like, what they are called, and where they sit in the list
*/

'use strict';

// The heads a classmate can have, dealt out per run. All animal faces, and
// none of them in the network, so a face is never also something you could
// send - faces.html is the sheet they were picked from.
const characterFaces = '🦊🐺🦝🐯🦁🦌🦍🐻🐹🐷🐨🐭🐰🐵🐼🐸🐙🐴🐗🐮🐔🐣';
// Sixteen, six dealt per run. Bex and Lux were cut on 2026-08-28: any two
// given names share a cast about one run in ten, and four of the eighteen
// ended in x - Rex and Bex differed by a letter, and Nyx and Lux were the
// next pair down. Two x names left, which is a cluster the eye can hold.
const characterNames = 'Kai Ada Iris Rex Nyx Mo Zed Juno Pip Sol Ivy Ash Tao Finn Uma Cy';

// Role and the one word the role guarantees - the archetypes, in roster
// order. The word is one of their two strongest loves, always (GDD 3), and
// where it is a club it is also where you run into them. Each also has a
// quirk, keyed on this index and never printed (GDD 3): the jock sweats
// exams (gloomy on exam weeks) and owns sports day, the bookworm lives for
// grades (bright on exam weeks, moved by your result), the artist is
// sentimental (keeps a present) and owns the culture festival, the queen
// bee knows everyone (in every falling-out's circle), the night owl is
// honest if you ask (❓ costs no affection) and owns Halloween. The gamer
// is just the gamer.
const characterData =
[
    ['the jock',      'sports'],
    ['the bookworm',  'science'],
    ['the artist',    'art'],
    ['the gamer',     'games'],
    ['the queen bee', 'style'],
    ['the night owl', 'night'],
];

// Who actually hangs out with whom: bomb fallout travels on these edges
// (GDD 7), one bit mask per classmate in the roster order above. The jock
// and the gamer; the bookworm with the artist and with the gamer; the artist
// and the night owl - and the queen bee, who knows everyone, so she is in
// every circle and every circle is in hers. Symmetric, which test/week.mjs
// leans on. It was a list of pairs plus a special case for the queen bee,
// which said it better and cost bytes to say.
const characterCircles = [24, 28, 50, 19, 47, 20];

function charFriends(a, b) { return a != b && characterCircles[a] >> b & 1; }


let characters = [];

// the cast in the order the phone lists them, which is dealt per run as well:
// the jock is not always the top row. Everything that walks characters by
// index keeps the fixed archetype order; everything that shows them uses this.
function cast() { return [...characters].sort((a, b) => a.seat - b.seat); }

// Who is on your phone yet. You start the year knowing three of them and meet
// the other three at the ends of the first three weeks (GDD 3), so the contact
// list fills from the top - and because a seat is dealt from the seed, which
// three turn up late is dealt with it. Derived from the week, so there is
// nothing here to save, and everything the PLAYER sees a classmate in goes
// through this: Messages, Notes, Stats, the calendar, and the week engine.
// cast() is what still walks all six - the endings count the whole class.
function charMet() { return cast().slice(0, gameWeek + 3); }

///////////////////////////////////////////////////////////////////////////////

// one classmate: an archetype, and the opinions the player has to deduce
class Character
{
    constructor([role, word], idx)
    {
        // where they sit in characters, which is the fixed archetype order -
        // the number the save, the news cards, the friend edges and the
        // epilogues all key on. It is characters.indexOf(c) with the search
        // done once at the start of the year instead of everywhere, forever.
        this.idx = idx;
        this.role = role;
        this.word = word;   // the like the role guarantees, so ❓ never sells it (GDD 5)

        // A role's word is a like, not a club - but five of the six are club
        // words, and that is where you run into them at school. The night
        // owl's is night; she haunts none.
        this.club = netClubs.includes(word) ? word : '';

        // how they feel, what they have heard lately, and this week's mood
        this.affection = 0;
        this.thread = [];
        this.reactions = {};    // emoji -> [best, worst] raw taste (GDD 6)
        this.fav = '';          // the emoji that hit their top, once one has (GDD 6, 9)
        this.told = [];         // the words a ❓ has had answered, in order (GDD 5)
        this.prompt = '';       // the last thing they showed you (GDD 4)
        this.heard = 0;         // heard from you this week (GDD 3)
        this.quiet = 0;         // weeks running without (GDD 3)
        this.strikes = 0;       // and how often that has cost them

        this.incoming = 0;  // they texted you and you have not answered
        this.lastDate = -9;     // the week you last took them out (GDD 9)
        this.mood = 0;      // the week they are having: -2 😡 to +2 🥰 (GDD 3)
    }
}

// A new game rolls every character's opinions from one seed (GDD 3), and then
// their looks. Looks come after the opinions on purpose: a seed's puzzle stays
// the same puzzle whatever the cast happens to look like.
function initCharacters(seed)
{
    netSetSeed(seed);
    characters = characterData.map((data, i) => new Character(data, i));

    // faces, names and seats in the list are dealt without replacement, and
    // the hues go round the wheel a sixth of a turn at a time, so no two
    // classmates share one
    const faces = netSplit(characterFaces), names = characterNames.split(' ');
    const seats = characters.map((c, i) => i);
    const hue = netRandInt(360);
    const draw = list => list.splice(netRandInt(list.length), 1)[0];
    characters.forEach((c, i) =>
    {
        c.name = draw(names);
        c.seat = draw(seats);
        c.avatar = avatar(draw(faces), hue + i*60 + netRandInt(41) - 20,
            2 + netRandInt(11)/10, .9 + netRandInt(3)/10, netRandInt(9) - 4);

        // the roll: five ranked opinions, the role's word among the two
        // strongest (GDD 3) - and what is on their mind from day one, so the
        // very first text has something to answer (GDD 4). The prompt is
        // saved from here on; this draw is only ever the opening one.
        c.opinions = scoreRollOpinions(characterData[i][1]);
        c.prompt = scorePrompt(c.opinions);

        // the week they open on (GDD 3): the three on the phone in week one
        // show one mood each - bright, plain, gloomy, by seat - so the faces
        // mean something from the first screen; the rest get a week of their own
        c.mood = c.seat < 3 ? 1 - c.seat : netRandInt(3) - 1;

        // the best this roll can ever do (GDD 6, 9): scoreValidate's own
        // SCORE_BEST_FLOOR floor already guarantees this is at least 4, so
        // every classmate has a favourite worth finding. Derived from the
        // seed like the opinions above, so it never needs saving - c.fav,
        // the emoji that actually landed on it, is the one that does.
        c.top = max(...netLib.map(r => scoreTaste(r.e, c.opinions)));
    });
}
