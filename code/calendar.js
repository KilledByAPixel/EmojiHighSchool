/*
    The school year (GDD sections 2, 9 and 10)
    - one school year, April to March, one turn per week
    - each week has three slots: a weekday activity, ONE phone action, and the
      weekend. The scarcity of the phone slot is the strategic core
    - the calendar is the home screen, and it is where the year is legible:
      what is coming, what season it is, and what it is about to cost you
*/

'use strict';

const calWeeks = 40;              // playable weeks, April through March

// Neglect and incoming (GDD 3 and 9), the pressure that makes one action a
// week actually matter. All three out of test/sim.mjs: the write-off is the
// 😊 rung exactly, so being given up on costs you the friendship and takes
// most of a term of the drip a neglected classmate gets to earn back; the
// ripple is a third of it; and every other week is the only gap that leaves a
// worked-out player falling in love in March - every week and they are there
// by week 28, every third and only half of them get there at all.
const CAL_WRITEOFF = 90;      // 📏 affection lost when they give up on you
const CAL_RIPPLE = 30;        // 📏 affection their friend circle loses too
const CAL_INCOMING_GAP = 2;   // 📏 weeks between an unprompted incoming

// The year as a real calendar: twelve months of three or four weeks, which is
// what lets a week be a row of seven days instead of a numbered box (GDD 9).
// A short month still draws four rows - its last one is a week off.
const calMonthWeeks = [4,3,3,4,3,3,4,3,3,4,3,3];

// Exams (GDD 8): five questions, pass on three, graded against the best your
// own keyboard could have answered - within one point a prompt. The margin
// grows with the question because the best answer's score does: overlap is
// summed over every prompt, so a three-prompt best is about 7 where a
// one-prompt best is 3, and it collects incidental matches - this prompt's
// colour, that one's tag - that the player is never told to look for. A
// flat 2 passed the legible answer (the one of mine that carries the most
// of what these share) on 100% of one-prompt questions and 60% of
// three-prompt ones; one a prompt makes that 100 / 87 / 80, a ramp instead
// of a cliff. The tuning table is GDD 15.
const CAL_EXAM_QUESTIONS = 5;   // 🔸 five questions to a sitting
const CAL_EXAM_PASS = 3;        // 🔸 pass on this many of the five

// prompts per question, 0-based: one, two, three, in both exams - one more
// thing that has to be in common narrows the search without changing the
// rule (GDD 8)
// how many emoji a question shows: one, two, three, and three from there -
// four or five that share a word are drawable, but no harder to answer
function calExamPrompts(q) { return min(3, q + 1); }

// The week, the emoji, and the name of everything that happens in a year
// (GDD 9). A week can carry two of these - the first one listed is the one
// the week IS, and the other only comes up as something the year is bringing.
// The fourth column is whose week it is: the one classmate it brightens
// (GDD 3), or -1 for the whole school. Nothing in this list does nothing:
// the rest have a mechanic of their own (the exam, the mascot's gift, the
// two one-week places, the two gift days, the tree).
const calEvents =
[
    [0,  '🌸', 'new school year'],
    [11, '📝', 'exams', 1, 'science'],  // the bookworm lives for grades
    [12, '🦄', 'Unicorn Week'],       // js13k's own number: the mascot's week, its own
    [16, '🎆', 'summer festival'],
    [20, '🏃', 'sports day', 0, 'sports'],      // the jock's day
    [23, '🎃', 'Halloween', 5, 'scary'],        // the night owl's
    [26, '🎭', 'culture festival', 2, 'art'],   // the artist's
    [30, '🎄', 'winter party', -1, 'cold'],     // everyone's
    [33, '⛩️', 'New Year'],
    [35, '🍫', "Valentine's"],        // runs the other way - crushes give to you
    [36, '📝', 'exams', 1, 'science'],
    [38, '🤍', 'White Day'],          // the player's turn, three weeks on
    [39, '🌳', 'graduation'],         // the confession
];

let gameWeek = 0;
// This week's cards, both of them [who, ...] with who an index into the cast,
// because both go into the save and a character object does not.
let calGifts = [];  // [who, emoji] - what people gave you, on the weeks they do
let calLearned = []; // [who, emoji] - what a classmate taught you this week
let calNews = [];   // [who, title, line] - what happened while you were out
let calNewsNext = [];   // the same, for the Monday after this week end: what the
                        // weekend already knows before calEndWeek resets calNews
let weekActivityUsed = 0, weekPhoneUsed = 0;
let activityClub = '', activityLearned = '';   // this week's club, and its keep
let examResult = '';
let calForcedClub = '';      // failing an exam takes next week's choice away (GDD 8)
let activityMet = 0;         // [who, emoji, face] when someone was at the club
let calShowMonth = 0;        // the month the calendar app is turned to

// This sitting's three questions and where you are in them - GDD 8's one
// place the game names its attributes out loud.
let calExamQ = [];
let calExamAt = 0;
let calExamPassed = 0;
let calExamResults = [];     // 1 pass, 0 fail, one per exam sat (GDD 11, 13)

///////////////////////////////////////////////////////////////////////////////

// spring, summer, autumn, winter - which places are open for a date or a
// trip this week (GDD 10), and what the phone's own status bar reads
function calSeason(week = gameWeek)
{
    return week < 9 ? 0 : week < 18 ? 1 : week < 27 ? 2 : 3;
}

// a week's whole row out of calEvents, or an empty one - week, glyph, name,
// whose it is, what it puts on their mind. Everything that asks the calendar
// what a week is comes through here, so the lookup is written once.
function calEventRow(week = gameWeek) { return calEvents.find(([w]) => w == week) || []; }

// the event on a week, or nothing, and what an event is called
function calEvent(week) { return calEventRow(week)[1] || ''; }

function calEventName(event) { return calEvents.find(([, e]) => e == event)[2]; }

// whose week this is (calEvents' fourth column): the roster index of the one
// classmate the week brightens, -1 for the whole school, undefined otherwise
function calWhose() { return calEventRow()[3]; }

// which month a week falls in, and the week that month starts on
function calMonth(week = gameWeek)
{
    let month = 0, first = 0;
    while (first + calMonthWeeks[month] <= week)
        first += calMonthWeeks[month++];
    return [month, first];
}

function calIsExam(week = gameWeek) { return calEvent(week) == '📝'; }

// one phone action a week, every week, with no exceptions left (GDD 9)
function calPhoneAvailable() { return weekPhoneUsed < 1; }

///////////////////////////////////////////////////////////////////////////////
// Exams (GDD 8): the same verb with nobody attached. Three questions, each
// asking what a few library emoji have in common - answer with the one of
// your own that shares the most, and this is graded against your own
// keyboard's best, never the library's.

// every attribute word this emoji actually carries - club, colour, size, or
// a tag - the same profile scoreOverlap reads against
function calExamWords(emoji)
{
    const rec = netByEmoji[emoji];
    return [rec.club, rec.colour, ...rec.tags];
}

// Every word all these prompts share - that shared word is what makes the
// question answerable, and the exam is the one place it gets named out loud.
//
// Every shared word is meaningful now: tiny and huge are ordinary tags, not a
// size axis with a neutral middle value.
function calExamShared(prompts)
{
    const [first, ...rest] = prompts.map(calExamWords);
    return first.filter(word => rest.every(words => words.includes(word)));
}

// this answer's score against every prompt, summed (GDD 8)
function calExamScore(emoji, prompts)
{
    return prompts.reduce((n, p) => n + scoreOverlap(emoji, p), 0);
}

// the best your own keyboard could have answered - what you are actually
// marked against, never the best answer in the library, and never one of
// the prompts themselves
function calExamBest(prompts)
{
    const mine = Object.keys(playerKeyboard).filter(calExamKeyLive);
    return mine.reduce((best, e) =>
    {
        const score = calExamScore(e, prompts);
        return score > best.score ? {e, score} : best;
    }, {e: mine[0], score: -1});
}

// one question's prompts: real library emoji, never the keyboard, redrawn as
// a set until they share at least one attribute word (GDD 8)
function calExamDraw(n)
{
    // Only out of what you do NOT own. The exam is a test on the library, not
    // on your own shelf - and drawing from the rest of it means an answer can
    // never be one of the prompts - so no rule has to say so, and no key on
    // the keyboard has to be greyed out and explained.
    //
    // The pool cannot run dry, measured rather than guessed: a greedy
    // collector - a School pick every week, a trip every weekend rather than
    // a date, and every Valentine's present - owns about 80 of the library by
    // the second exam on week 36, which leaves seventy-odd to draw three
    // prompts from.
    const pool = netLib.filter(rec => !playerOwns(rec.e));
    while (1)
    {
        const prompts = [...Array(n)].map(() => netPick(pool).e);
        if (new Set(prompts).size < n)
            continue;
        const shared = calExamShared(prompts);
        if (shared.length)
            return {prompts, shared, best: calExamBest(prompts)};
    }
}

// the whole sitting: five questions, each with its own answerable prompts,
// one more of them than the last up to three (GDD 8)
function calExamBuild()
{
    return [...Array(CAL_EXAM_QUESTIONS)].map((v, q) => calExamDraw(calExamPrompts(q)));
}

// a legal exam answer: owned, and never one of the three tone faces (GDD 8).
// The question's own prompts need no exclusion - they are drawn from what
// you do NOT own, so an answer can never be one of them.
function calExamKeyLive(emoji)
{
    return playerOwns(emoji) && netByEmoji[emoji];
}

// begin a sitting: build the three questions and open the first one. The
// week's activity slot is not spent until the sitting is actually finished,
// so leaving mid-exam and coming back through School resumes it rather than
// losing it.
function calExamStart()
{
    calExamQ = calExamBuild();
    calExamAt = 0;
    calExamPassed = 0;
}

// grade one question: score against every prompt, pass within one point a
// prompt of your own keyboard's best (GDD 8). That best is always >= 0 and
// so is any score, so
// a keyboard with nothing to say passes by definition - the margin check
// alone already covers it, no separate case needed.
function calExamAnswer(emoji)
{
    const q = calExamQ[calExamAt];
    if (!q || q.graded || !calExamKeyLive(emoji))
        return;
    q.answer = emoji;
    q.score = calExamScore(emoji, q.prompts);
    q.pass = q.score >= q.best.score - q.prompts.length;
    q.graded = 1;
    if (q.pass)
        ++calExamPassed;
    playSound(q.pass ? soundGood : soundBad);
}

// move past the graded question - to the next one, or to the final result
function calExamNext()
{
    if (++calExamAt >= CAL_EXAM_QUESTIONS)
        calExamFinish(calExamPassed);
}

// close out the sitting: pass on CAL_EXAM_PASS of CAL_EXAM_QUESTIONS, record
// it for the ending (GDD 11) and the save (GDD 13), and - failing - hand
// next week's club to the one you are weakest in (GDD 8). The bookworm hears
// how it went either way (her quirk).
function calExamFinish(passed)
{
    const ok = passed >= CAL_EXAM_PASS;
    calExamResults.push(ok ? 1 : 0);
    examResult = ok ? '💯' : '📉';
    weekActivityUsed = 1;
    playSound(ok ? soundGood : soundBad);

    if (!ok)
        calForcedClub = netClubs.reduce((thin, club) =>
            calOwnedIn(club) < calOwnedIn(thin) ? club : thin);

    const ada = characters[1];
    if (chatTier(ada) < 4)
        ada.affection += ok ? 4 : -3;
    return ok;
}

// not turning up is not a way out of an exam, it is a way to fail one - no
// partial credit for questions never answered (GDD 8). calEndWeek calls this
// when the exam slot goes unspent.
function calTakeExam() { return calExamFinish(0); }

// The week each of them is about to have (GDD 3), rolled at the week end
// for the week just begun: the two ends hold, because 🥰 and 😡 are about
// you and nothing but you moves them; then the calendar; then - if you were
// in touch this week - whatever you left them in, and otherwise a life of
// their own, which shifts about one week in three. Neglect, a missed
// birthday and a write-off all set the mood after this runs, so they stick.
function calRollMood(c)
{
    if (abs(c.mood) > 1)
        return c.mood;
    if (calBirthday(c) == gameWeek)
        return 1;
    if (c == characters[0] && (calIsExam() || calIsExam(gameWeek + 1)))
        return -1;   // the jock sweats exams (his quirk), the week before too
    const whose = calWhose();   // the bookworm's exams, the jock's sports day...
    if (whose == -1 || c == characters[whose])
        return 1;
    return c.heard || netRandInt(3) ? c.mood : netRandInt(3) - 1;
}

// End the week: resolve the weekend, then roll everything forward.
function calEndWeek()
{
    // what the weekend already knows Monday will say - a run-in on the day
    // out, a Saturday somebody heard about (GDD 10) - goes in first
    calNews = calNewsNext;
    calNewsNext = [];

    // not turning up is not a way out of an exam, it is a way to fail one
    const wasExam = calIsExam();
    if (wasExam && !weekActivityUsed)
        calTakeExam();

    ++gameWeek;
    weekActivityUsed = weekPhoneUsed = 0;
    activityClub = activityLearned = tripPlace = '';
    activityMet = 0;
    examResult = '';
    calGifts = [];
    calLearned = [];

    // the week each of them is about to have (GDD 3) - rolled first, so
    // everything the rest of this week end does to a mood sticks
    for (const c of characters)
        c.mood = calRollMood(c);

    // a crush keeps count of their own birthday, not White Day, which stays
    // free to give on rather than something to be punished for skipping
    // (design pass T2) - hearing from you at all this week, the same
    // standard neglect uses, is what lets them off
    for (const c of charMet())
        if (calBirthday(c) == gameWeek - 1 && chatTier(c) <= 1 && !c.heard)
        {
            c.affection -= 3;
            c.mood = min(c.mood, -1);
            calNews.push([c.idx, `${c.name} waited all week`,
                'a day like that deserved something']);
        }

    // The other three classmates turn up over the first three weeks (GDD 3), one
    // seat at a time, and arrive with the same opening the three you started
    // with came with: a face, and who they are. The
    // seat charMet() just grew into is the whole of the rule, so the two
    // cannot drift apart - and it runs out on its own once the class is in.
    const arriving = charMet()[gameWeek + 2];
    if (arriving)
        calNews.push([arriving.idx, `you met ${arriving.name}`,
            arriving.role]);

    // Unicorn Week (GDD 9): week thirteen is js13k's own number, so the
    // school mascot is about, handing out the one emoji that goes with
    // everything - a week of its own, the first exams being the week before.
    // The week's own card says so (calEventCard); nothing costs a slot.
    if (gameWeek == 12)
        playerUnlock('🦄');

    // the sitting just finished (or was skipped) is done with, either way -
    // clearing it here, rather than the moment it finishes, is what leaves
    // the finished screen visible until the player actually leaves it, and
    // is what reopens the next exam's own gate (!calExamQ.length) rather
    // than re-showing this one's stale result 24 weeks later
    calExamQ = [];
    calExamAt = calExamPassed = 0;

    // a forced club (GDD 8) is a one-week penalty for the week right after a
    // failed exam - clear it once that week is over. Never on the exam's own
    // transition: a fail above (or one already sat earlier this week) just
    // set it for the week about to start, and it has to survive into that
    // week rather than being wiped before it is ever offered.
    if (!wasExam)
        calForcedClub = '';

    // a repeat goes stale, but not forever: they forget one a week, so a
    // favourite comes back around instead of being spent for good (GDD 4)
    playerDecay();

    // Neglect (GDD 3) 📏: four quiet weeks running and it starts to cost them
    // - three until the sim counted write-offs properly and found a
    // worked-out player answering every warning still losing somebody one
    // year in five on one text a week. Texting, gifting, a date, or running
    // into them at their club all count as hearing from you, and any of them
    // resets the clock. Every gloom in here is a floor, not a value:
    // somebody already 😡 stays 😡, because nothing takes the edge off that
    // but hearing from you.
    for (const c of charMet())
        if (chatTier(c) < 4)
        {
            if (c.heard)
                c.quiet = c.strikes = 0;
            else if (++c.quiet >= 4)
            {
                ++c.strikes, c.mood = min(c.mood, -1);   // and it shows, as the mood (GDD 3)
                // the 💣 explains itself the Monday it appears (GDD 3): what
                // it is, and what leaving it costs - a glyph nobody can decode
                // is a rule nobody can see
                if (c.strikes == 2)
                    calNews.push([c.idx,
                        `${c.name} has not heard from you in ${c.quiet} weeks`,
                        '💣 two more and they give up on you']);
            }

            // the one warning: a cold text that jumps the queue, so being
            // written off only ever happens to someone who ignored a
            // message actually sitting on their screen
            if (c.strikes == 3)
            {
                for (const o of characters)
                    if (o != c && o.incoming == 1)
                        o.incoming = 0;
                chatIncoming(c, 1);
            }
            // four strikes and they give up on you
            else if (c.strikes >= 4)
                calWriteOff(c);
        }

    // What is on their mind drifts (GDD 3): one of the people you did not
    // talk to this week picks up something else they like, so a quiet row
    // still moves, and still leaks taste to anyone paying attention - one a
    // week, never more, and never somebody you were in touch with.
    const quiet = charMet().filter(c => !c.heard);
    if (quiet.length)
    {
        const c = netPick(quiet);
        c.prompt = scorePrompt(c.opinions);
    }

    // A text you never answered does not wait past the week: it goes, and
    // they are gloomy about it - unless they heard from you some other way,
    // a date or a run-in, which answers it well enough (GDD 9). The one
    // warning - the cold text - stays, because the next strike is the
    // write-off.
    for (const c of characters)
        if (c.incoming == 1)
            c.incoming = 0, c.heard || (c.mood = min(c.mood, -1));

    // the week's contact clock, spent either way
    for (const c of characters)
        c.heard = 0;

    // The calendar puts something on their mind (GDD 3): on somebody's week
    // the prompt on their row is the thing of the day they like best - a
    // ball for the jock on sports day, something cold for everyone at the
    // winter party - so the week says what to send. Somebody who texts first
    // this week (below) has their own thing to say instead.
    const [, , , whose, word] = calEventRow();
    if (word)
        for (const c of characters)
            if (whose == -1 || c == characters[whose])
                c.prompt = netLib.filter(r => scoreDist(r, word) == 0).sort((a, b) =>
                    scoreTaste(b.e, c.opinions) - scoreTaste(a.e, c.opinions))[0].e;


    // Somebody texting you first is a clue, and a call on the week's one
    // text (GDD 9); never more than one waits at a time. Who reaches out is
    // weighted by affection: a favourite spends their turn on you, and the
    // neglected stay quiet - right up until their own warning above, which
    // outranks this every time.
    if (!chatWaiting() && !(gameWeek % CAL_INCOMING_GAP))
    {
        const known = charMet().filter(c => chatTier(c) < 4);
        if (known.length)
        {
            const texter = calIncomingSender(known);
            chatIncoming(texter);
            calNews.push([texter.idx, `${texter.name} texted you`,
                'waiting on your one text']);
        }
    }

    // Valentine's Day runs the other way (GDD 9 ✅): the player is the one
    // being courted this week. Everyone who counts you at least a crush
    // hands over one emoji they love that you do not already own - a
    // collectible and a clue in the same envelope, paid out before the
    // endings, because being liked buys evidence.
    if (calEvent() == '🍫')
        for (const c of charMet())
            if (chatTier(c) <= 1)   // 1 is crushing, 0 is in love
                chatGiftFrom(c);

    gameSave();  // one snapshot a week, at the only moment nothing is half done
}

// who reaches out: a seeded pick weighted by affection - the ones who like
// you spend their turn on you, and the neglected stay quiet (GDD 9)
function calIncomingSender(pool)
{
    let roll = netRandInt(pool.reduce((sum, c) => sum + c.affection, 0));
    return pool.find(c => (roll -= c.affection) < 0) || pool[pool.length - 1];
}

// Their birthday, spread evenly through the year - one classmate every six
// weeks, so there is almost always someone worth saving an emoji for (GDD 9)
function calBirthday(character) { return 3 + character.idx*6; }

// a week when giving something away means something: their birthday, or White
// Day, when the whole school is giving things back
function calGiftDay(character)
{
    return calBirthday(character) == gameWeek || calEvent() == '🤍';
}

// They give up on you (GDD 3): a big affection loss, and because people
// talk, a smaller one lands on everyone in their circle too - who turn 😡
// and say so, which is how the fallout is seen where it lands rather than
// explained. 😡 is the mood that holds until you text them, so the fallout
// is not over at the week end. A wound, not a lock - the strikes reset and
// the climb back is allowed, just long.
function calWriteOff(character)
{
    character.affection -= CAL_WRITEOFF;
    // the cold text goes with them: it is the message they gave up waiting
    // for, and only one incoming ever waits at a time (GDD 9), so leaving it
    // sitting there would silence every ordinary opener for the rest of the year
    character.quiet = character.strikes = character.incoming = 0;
    character.mood = min(character.mood, -1);
    character.thread.push({them: 1, text: '💣'});
    calNews.push([character.idx, `${character.name} gave up on you`,
        'and their friends heard about it']);
    playSound(soundSad);

    // charMet, not characters: someone you have not been introduced to yet
    // cannot have heard about it, and a debit they take now would be waiting
    // for you on the day they turn up (GDD 3)
    for (const c of charMet())
        if (charFriends(c.idx, character.idx))
        {
            c.affection -= CAL_RIPPLE;
            c.mood = -2;
            c.thread.push({them: 1, text: '😡'});
        }
}

// the bomb a neglected contact wears in the list from the second strike
// (GDD 3) - the first one shows as the mood, not here
function calUpsetIcon(character)
{
    return character.strikes > 1 ? '💣' : '';
}


// the good ending's floor, stated once and shown every week from week one -
// a goal you cannot see is not a goal (GDD 11)
const CAL_GOAL = 'nobody a stranger, both exams';

///////////////////////////////////////////////////////////////////////////////
// The Calendar app: a read only view of the year, the week is spent from home

function calendarHTML()
{
    const upcoming = [...calEvents,
        ...charMet().map(c => [calBirthday(c), '🎂', `${c.name}'s birthday`])]
        .filter(([week]) => week > gameWeek)
        .sort((a, b) => a[0] - b[0]).slice(0, 3);

    // the month you are looking at, which is this one until you page away
    const month = calShowMonth;
    const first = calMonthWeeks.slice(0, month).reduce((a, b) => a + b, 0);
    const here = calMonth()[0];

    // The arrow past either end of the year is a ghost: still there, so the
    // month stays centred, but invisible, and the action clamps what it sends.
    // A plain flex box and never a .row: a row shrinks on :active, and that
    // fires for a press anywhere inside it - on the month's name, and on the
    // arrows themselves, which slid out from under the finger so a tap near
    // an edge released on nothing. The arrows are .btn and press on their own.
    return `<div style="display:flex;align-items:center">` +
        button('month', month - 1, '‹', month ? '' : 'ghost') +
        `<h1 style="flex:1">${deviceMonths[month]}</h1>` +
        button('month', month + 1, '›', month < calMonthWeeks.length - 1 ? '' : 'ghost') +
        `</div>` +

        hint(month == here ? `week ${gameWeek + 1} of ${calWeeks} - ` +
            `${deviceSeasons[calSeason()][1]}` :
            `${month < here ? 'behind you' : 'still to come'} - ` +
            `${deviceSeasons[calSeason(first)][1]}`) +

        // The month, as a month: four rows of seven days, and the week you are
        // living in highlighted the whole way along. A turn is a whole row,
        // which is the thing a box per week never managed to say. The year is
        // forty weeks and twelve does not divide it, so a short month draws its
        // fourth row as a week off - numbered on, coloured its own way, and
        // carrying no week of the year: never now, never past, nothing on it.
        // Three rows read as a bug; four with one off reads as a holiday.
        `<div class=cal>` + [...'MTWTFSS'].map(d => `<b>${d}</b>`).join('') +
        [...Array(4)].map((v, w) =>
        {
            // a week off is no week of the year: it sits past the end of it, so
            // nothing below finds an event, a birthday, this week or a past one
            const off = w >= calMonthWeeks[month];
            const week = off ? calWeeks : first + w;
            const on = calEvent(week);
            const bday = charMet().find(c => calBirthday(c) == week);
            const day = calIsExam(week) ? 2 : 5;   // exams midweek, the rest on the weekend
            return [...Array(7)].map((u, d) =>
                `<div class="dy ${off ? 'off' : week == gameWeek ? 'now' : week < gameWeek ? 'past' : ''}">` +
                // a birthday on the weekday of its row: six of them land on
                // four different days, and never on the Saturday an event takes
                (bday && d == w ? `<span>${bday.avatar(16)}🎂</span>` :
                on && d == day ? `<span>${domSafe(on)}</span>` : w*7 + d + 1) +
                `</div>`).join('');
        }).join('') + `</div>` +

        // what is happening now, and what it does
        hint('this week') + calEventCard() + calDayCards() +

        // and what to brace for, so nothing is a surprise
        (upcoming.length ? hint('coming up') + upcoming.map(([week, icon, name]) =>
            card(glyph(icon, 30), name,
                `in ${week - gameWeek} week${week - gameWeek > 1 ? 's' : ''}`)).join('') : '') +

        (examResult ? hint(examResult == '💯' ? 'you passed the exam' :
            `you failed the exam - ${characters[1].name} heard about it`) : '');
}

///////////////////////////////////////////////////////////////////////////////
// The reminders: what this week is, whose birthday it is and what arrived,
// and what happened over the weekend. The home
// screen keeps them under the apps all week, so nothing gets clicked past.

// this week's event as a card, with what it does to the week - and whose
// week it is, when it is somebody's (GDD 3)
function calEventCard()
{
    const event = calEvent(), whose = calWhose();
    return card(glyph(event || '🎒', 38),
        event ? calEventName(event) : 'normal school week',
        calIsExam() ? `pass ${CAL_EXAM_PASS} of ${CAL_EXAM_QUESTIONS} questions - ` +
            `what do a few of these have in common?` :
        event == '🍫' ? 'everyone who likes you back gives you something' :
        event == '🤍' ? 'the whole school gives back - a present for anyone' :
        event == '🌳' ? `the last day - ${CAL_GOAL}` :
        event == '🦄' ? 'the school mascot is about - 🦄 is yours, and goes with everything' :
        whose == -1 ? 'the whole school is in a good mood' :
        whose >= 0 ? `${characters[whose].name} is in a good mood` : '');
}

// The cards the calendar and the home screen both show: whose birthday it is,
// and what arrived, on the weeks things arrive. White Day is not anyone's
// birthday and has its own card as the week's event, so it does not list the
// whole school here.
function calDayCards()
{
    return charMet().filter(c => calBirthday(c) == gameWeek).map(c =>
            card(c.avatar(38), `${c.name}'s birthday this week`,
                'bring them an emoji')).join('') +
        calGifts.map(([who, gift]) =>
            card(characters[who].avatar(38),
                `${characters[who].name} gave you ${gift}`,
                'it is on your keyboard now')).join('') +
        calLearned.map(([who, emoji]) =>
            card(characters[who].avatar(38),
                `${characters[who].name} taught you ${emoji}`,
                'it is on your keyboard now')).join('');
}

function calRemindersHTML()
{
    // every piece of news is about somebody, and wears their face
    return (calEvent() ? calEventCard() : '') +
        calNews.map(([who, title, line]) =>
            card(characters[who].avatar(38), title, line)).join('') +
        calDayCards();
}

///////////////////////////////////////////////////////////////////////////////
// The School app: pick a club, then learn one emoji out of it (GDD 5)

// how much of a club you own - the exam's forced pick and the School page
// both count it (GDD 7, 8)
function calOwnedIn(club) { return netClub(club).filter(rec => playerOwns(rec.e)).length; }

// What this week's club offers: three emoji you do not own, in an order that
// is stable for the week, so the offer cannot be rerolled by leaving and
// coming back - and the one just learned stays on the shelf until Monday, so
// the page can show what was kept among what was not. A club with nothing
// left to teach offers nothing (GDD 7).
function activityChoices(club)
{
    return playerOffers(netClub(club).map(rec => rec.e),
        gameWeek*3 + netClubs.indexOf(club), activityLearned);
}

// Running into somebody (GDD 7, 10): at their club, or on a day out at a
// place they love. They show you something of theirs first, so the thread
// reads as running into them rather than as a text you never remember
// sending - and their prompt goes up before the answer is scored, so the
// overlap it pays is the one the thread actually shows (GDD 4). Scored as a
// text with no face on it, through the one scorer every other exchange uses
// (GDD 4): taste weighted in the total, raw taste in the tapback, the fact in
// Notes the same way - and it counts as hearing from you (GDD 3). Scoring it
// any other way makes a free encounter read colder than the same emoji said
// out loud. Returns the face it landed on, for the card that says.
function calRunIn(c, emoji)
{
    const result = chatScoreSend(c, [emoji], '');
    c.affection += result.total;
    chatLand(c, result.total);
    c.heard = 1;
    chatPost(c, [emoji], result);
    chatReact(c, emoji, result.parts[0].taste);
    return scoreFace(result.total);
}

// Who was at school this week (GDD 7): the draw, weighted by what each of
// them would make of the emoji you just learned. A club is a place, not a
// person - nobody lives in one, and anybody you know can turn up in any.
function calActivityWho(emoji)
{
    return charEncounter(c => scoreTaste(emoji, c.opinions));
}

// spend the week on this choice
function activityPick(emoji)
{
    activityMet = 0;
    calForcedClub = '';   // a forced pick only ever costs the one week (GDD 8)
    playerUnlock(emoji);

    // School is where you run into a met classmate, weighted toward someone
    // who likes the emoji you just learned. It is seeded, not a free reroll.
    // the home screen reads how it landed straight off this, so the
    // encounter says what it earned where the player is standing rather
    // than only inside a thread they have to go and open (GDD 12)
    const who = calActivityWho(emoji);
    if (who)
        activityMet = [who, emoji, calRunIn(who, emoji)];

    weekActivityUsed = 1;
    activityLearned = emoji;
    playSound(soundGood);
}

function activityHTML()
{
    // exam weeks take the school slot instead of a club
    if (calIsExam())
        return calExamHTML();

    // Two small choices rather than one page of everything (GDD 7): a club
    // first, off a list that shows no emoji at all, then one of its three
    // offers. The club is set the moment it is tapped - there is no way back
    // to the list that week, and leaving and coming back lands on its three
    // offers again. Once one is learned the page shows what was kept, the
    // other two greyed, until Monday. Failing the last exam sets the club
    // itself, to the one you are weakest in, this week only (GDD 8) - unless
    // there is nothing left to learn there, in which case the list comes back
    // rather than trapping the pick. A club with nothing left is not listed.
    const forced = calForcedClub && activityChoices(calForcedClub).length ? calForcedClub : '';
    const done = activityLearned;
    const club = done ? netByEmoji[done].club : activityClub || forced;
    const learned = c => `${calOwnedIn(c)} of ${netClub(c).length} learned`;
    // The club list is deliberately about the school choice, not about who
    // happens to be there. The encounter is revealed after the emoji is kept.
    if (!club)
        return `<h1>School</h1>` + hint('pick a club to learn from this week') +
            netClubs.map((c, i) => activityChoices(c).length ?
                tap('club', c, 'row', rowBody(['⚽','🍔','🌿','🐶','🎨','🔬','🎮','💄'][i], `<b>${c}</b>`, learned(c))) : '').join('');

    return `<h1>${club} club</h1>` +
        hint(forced && !activityClub && !done ?
            `you failed the exam - ${club} club only, this week` :
            done ? 'one a week - the rest can wait for Monday' :
            'learn one - the club is yours for the week') +
        `<div class=picks>` + activityChoices(club).map(emoji =>
            done ? `<div class="pick${emoji == done ? '' : ' off'}"><b>${emoji}</b></div>` :
            tap('pick', emoji, 'pick', `<b>${emoji}</b>`)).join('') + `</div>` +
        hint(learned(club));
}

// The exam screen: an intro, five questions one at a time - prompts, then
// the keyboard as the answer sheet - and after each, the graded result and
// the best answer the keyboard held (GDD 8).
function calExamHTML()
{
    if (!calExamQ.length)
        return `<h1>Exams</h1>` +
            hint('five questions: pick one of yours that most matches the emoji shown') +
            hint(`pass ${CAL_EXAM_PASS} of ${CAL_EXAM_QUESTIONS} - both exams count at ` +
                `graduation, and a fail costs next week's pick`) +
            button('exam', 0, '📝 sit the exam', 'go');

    if (calExamAt >= CAL_EXAM_QUESTIONS)
        return `<h1>Exams</h1>` +
            card(glyph(examResult, 38), examResult == '💯' ? 'you passed' : 'you failed',
                `${calExamPassed} of ${CAL_EXAM_QUESTIONS} questions`) +
            (examResult != '💯' ? hint(`${calForcedClub} club only, next week - ` +
                'you own the fewest there') : '') +
            button('home', 0, 'done', 'go');

    const q = calExamQ[calExamAt];

    // just graded: the shared word, whether it landed, and the best answer
    // the keyboard held - the fastest vocabulary lesson in the game (GDD 8)
    if (q.graded)
        return `<h1>Question ${calExamAt + 1}</h1>` +
            hint(`${q.prompts.length > 1 ? 'they share' : 'it is'}: ${q.shared.join(', ')}`) +
            card(glyph(q.answer, 38), q.pass ? 'close enough' : 'not close enough',
                `you scored ${q.score}`) +
            card(glyph(q.best.e, 38), 'your best answer',
                q.best.e == q.answer ? 'that is what you sent' : `scores ${q.best.score}`) +
            button('examnext', 0, calExamAt + 1 < CAL_EXAM_QUESTIONS ?
                'next question' : 'see result', 'go');

    return `<h1>Question ${calExamAt + 1} of ${CAL_EXAM_QUESTIONS}</h1>` +
        hint(`pick one of yours that most matches ${q.prompts.length > 1 ? 'these' : 'this one'}`) +
        `<div class=picks>${q.prompts.map(e => glyph(e, 46)).join('')}</div>` +
        chatKeyboardHTML(calExamKeyLive, 'examkey');
}
