/*
    The Messages and Notes apps (GDD sections 6 and 12)
    - a message is one or two emoji, and they answer in one bubble: how it
      landed, and something of their own beside it
    - the per emoji tapbacks are pinned to the player's own bubble, so the
      player always knows which half landed
    - the thread doubles as the deduction notebook, no paper notes needed
    - the keyboard shows what you own, a row per club, and nothing you do not -
      except a present, which leaves its empty slot behind (GDD 9); the shape
      of what is missing lives in the dictionary (GDD 5)
    - words label the interface, never the conversation: what people say to
      each other is emoji only, and that is the whole puzzle
*/

'use strict';

// Mood (GDD 3): the week each of them is having, on top of how they feel
// about you. Five states, five faces: -2 😡, -1 😔, 0 😐, +1 😄, +2 🥰 -
// plain being the same flat face a stranger's rung wears, on purpose: plain
// is plain. The middle three are the weather; the two ends are about you,
// and only something you do moves them. What sets it is calRollMood and
// every exchange that scores (chatLand); what it does is chatMoodScale,
// through the one scorer. It replaced the weekly away message, a random
// line with nothing behind it (GDD 14).
const chatMoodFaces = ['😡', '😔', '😐', '😄', '🥰'];

function chatMoodIcon(c) { return chatMoodFaces[c.mood + 2]; }

// the line under the role on a contact row: their mood, and what is on
// their mind - the emoji their next text is about, which is what overlap
// pays for answering (GDD 4) - and, on the list, whatever else the week
// has to say about them in one glyph. Nothing they love is named.
function chatMoodLine(c, extra = '')
{
    return iconLine(chatMoodIcon(c), c.prompt + extra, 'mood');
}

// What the mood does to a total (GDD 3) 📏: a bright week pays this much
// more on a hit per step - a quarter under 😄, half under 🥰 - and a gloomy
// one costs the same on a miss, a quarter under 😔, half under 😡. Never
// across the other diagonal, so rescuing somebody gloomy is a judgement, not
// a jackpot. Truncated toward zero, the same as the 🙂 half. It opened at
// half again for the one step, which lifted every curve in test/sim.mjs by
// about a quarter and put a worked-out player in love with a term to spare.
// Not printed on the phone: the game's page outside it explains the number.
const CHAT_MOOD_STEP = .25;

function chatMoodScale(c, total)
{
    return c.mood*total > 0 ? total*(1 + CHAT_MOOD_STEP*abs(c.mood)) | 0 : total;
}

// What a message does to the mood (GDD 3): landing 😊 or better brightens
// them, landing below 😐 darkens them, the middle leaves it - set, not
// nudged, so one good text is a whole rescue from 😔. The two ends are the
// exception: a hit only calms 😡 to 😐 and a miss only cools 🥰 to 😐, a
// step, so it takes two texts to turn either right round - and a hit under
// 🥰 or a miss under 😡 leaves them where they are. Texts, presents and club
// run-ins all pass through here; a date does the same on the walk home.
function chatLand(c, total)
{
    if (total >= scoreFaces[1][0]) c.mood = c.mood < -1 ? 0 : max(c.mood, 1);
    else if (total < 0) c.mood = c.mood > 1 ? 0 : min(c.mood, -1);
}

// Affection ladder: threshold, and what it is called (GDD 7) 📏.
// The numbers are set against the length of the year, not against one good
// text, and they come out of test/sim.mjs playing 60 seeded years per kind of
// player: a worked-out text is worth 18 to 20 and a whole date about 27, so
// 20 is one good message, 90 is four or five, 500 is a term of dates, and 850
// is a school year of courtship. 90 is also the bar the good ending asks of
// the other five (GDD 11), which is what fixes it there: it is what a player
// who courts one classmate and keeps the rest warm actually gets them to, in
// about half of years. 850 puts in love in the last quarter of the year for a
// player who has worked somebody out, and later for everybody else - which is
// the point of it being the top rung. Measured in GDD 15.
const chatAffectionLadder =
[
    [850, 'in love'],
    [500, 'crushing'],
    [ 90, 'friend'],
    [ 20, 'acquaintance'],
    [-1e9, 'stranger'],
];

let chatContact;            // who is on screen
let chatCompose = [];       // up to two emoji, waiting to send
let chatJournalOpen = false;

///////////////////////////////////////////////////////////////////////////////

function chatOpen(character)
{
    chatContact = character;
    chatCompose = [];
    chatJournalOpen = false;
}

// A classmate can teach an emoji by showing it in a message. Gifts and trips
// use their own cards; this records the ordinary text-learning moment.
function chatLearn(character, emoji)
{
    if (netByEmoji[emoji] && !playerOwns(emoji))
    {
        playerUnlock(emoji);
        calLearned.push([character.idx, emoji]);
    }
}

// where they are on the ladder: 0 in love, 2 a friend, 4 a stranger. Anything
// that asks "do they like me enough for this yet" asks this, so the ladder
// stays the only place those numbers live.
function chatTier(character)
{
    return chatAffectionLadder.findIndex(([threshold]) =>
        character.affection >= threshold);
}

// the rung itself: threshold, and what it is called
function chatAffection(character) { return chatAffectionLadder[chatTier(character)]; }

// How they feel about you, as four hearts: one filled per rung above stranger
// (GDD 3). Emoji hearts rather than the text heart suits, because Twemoji holds
// the filled suit and not the outline, and the two would draw in two styles.
function chatHearts(character)
{
    const filled = 4 - chatTier(character);
    return '❤️'.repeat(filled) + domSafe('🤍').repeat(4 - filled);
}

// the column on the right of a contact row: the hearts, and the rung's own
// word under them so what they mean is always said - or, on the list, that
// a text of theirs is waiting
function chatFoot(character, note = chatAffection(character)[1])
{
    return `<b>${chatHearts(character)}</b>${note}`;
}

// The per emoji mini reaction, pinned to the emoji it belongs to (GDD 6a):
// raw taste, which runs about -5 to +6, against these steps. A table, the
// same shape as scoreFaces, because the notebook (chatReactionRows) prints
// one row per face in this order.
const chatTapbacks =
[
    [   3, '❤️'],
    [   1, '👍'],
    [   0, '😐'],
    [  -2, '👎'],
    [-1e9, '😡'],
];

function chatTapback(score)
{
    return chatTapbacks.find(([threshold]) => score >= threshold)[1];
}

///////////////////////////////////////////////////////////////////////////////

// What they have told you, in the order told (GDD 5): every word a ❓ ever
// got an answer about, with the feeling. Notes (GDD 12) owns how these
// read; here they are the words and nothing else.
function chatFact(character, word)
{
    const [, weight] = character.opinions.find(([a]) => a == word);
    return `${weight > 0 ? 'likes' : 'cannot stand'} ${word}`;
}

// every told opinion as a line, in the order told - the top of the Notes card
// and of the notebook inside a thread
function chatIntelFacts(character)
{
    return character.told.map(word => iconLine('💭', chatFact(character, word))).join('');
}

// What ❓ gets you (GDD 9): why they feel the way they do about this one
// emoji - the opinion of theirs it touches hardest, the role's word last
// because that one is on their row already - in words, and kept for Notes
// (c.told). Nothing touching it is an answer too: 🤷, and every attribute
// the emoji has ruled out at once.
function chatWhy(character, emoji)
{
    const rec = netByEmoji[emoji];
    const hit = character.opinions
        .map(([word, w]) => [word, max(0, abs(w) - scoreDist(rec, word))])
        .filter(([, n]) => n)
        .sort((a, b) => (a[0] == character.word) - (b[0] == character.word) || b[1] - a[1])[0];
    if (!hit)
        return '🤷';
    character.told.includes(hit[0]) || character.told.push(hit[0]);
    return chatFact(character, hit[0]);
}

// Sometimes they text you first (GDD 9). Answering costs the week's one text
// like anything else - the week is a choice - and what they show you is their
// mood plus a prompt, which leaks their taste whether or not you ever answer
// it (GDD 5); a text left unanswered goes at the week end, and they are
// gloomy about it (calEndWeek). The one neglect warning (GDD 3) reuses this
// same slot, but arrives cold - 💔,
// not their mood face - so it reads as visibly different from an ordinary
// opener. gameLoad rebuilds this same bubble.
function chatIncoming(character, cold)
{
    character.incoming = cold ? 2 : 1;
    character.prompt = scorePrompt(character.opinions);
    chatLearn(character, character.prompt);
    character.thread.push({them: 1, text: chatOpener(character) + character.prompt});
}

// how a text from them opens: cold if it is the warning, their mood otherwise
function chatOpener(character)
{
    return character.incoming == 2 ? '💔' : chatMoodIcon(character);
}

function chatWaiting() { return characters.some(c => c.incoming); }

// Valentine's Day runs the other way (GDD 9 ✅): calEndWeek calls this for
// every classmate at crushing or above, on the 🍫 week only. They reach for
// something they love that you do not own, so it lands as a collectible and
// a clue in the same envelope - the game handing you evidence before the
// endings, because being liked pays out early. Nobody qualifying (no unowned
// emoji they love enough) means nothing happens for them: never an error,
// and never a fallback gift they do not actually love.
function chatGiftFrom(character)
{
    const loved = netLib.filter(rec => !playerOwns(rec.e) &&
        scoreTaste(rec.e, character.opinions) >= SCORE_GOOD).map(rec => rec.e);
    if (!loved.length)
        return;

    const gift = netPick(loved);
    playerUnlock(gift);
    character.thread.push({them: 1, text: gift});
    calGifts.push([character.idx, gift]);
    return gift;
}

///////////////////////////////////////////////////////////////////////////////

// One exchange into a thread: what you sent, with its scores, and what came
// back - a face, or a whole message when they have something to show you.
// Every way of saying something to someone goes through here, so a thread
// always has the same shape whichever screen wrote it.
// The reply is optional, because not every exchange has one. Running into
// somebody at their club or on a day out (calRunIn) is the case: the tapback
// pinned to the player's own bubble already says how it landed, and the card
// on the home screen prints the face beside it as well, so a second bubble
// holding nothing but that same face read as a text they had sent for no
// reason at all.
function chatPost(character, emojis, result, reply)
{
    character.thread.push({mine: 1, emojis, ...result});
    reply && character.thread.push({them: 1, ...reply});
}

// legal shapes: one or two emoji, one emoji plus a tone face, or ❓ with one
// emoji - the question is about that emoji (GDD 9). A face never carries
// taste of its own, so it never travels solo and never doubles up with a
// second face; ❓ takes the slot a face or a second emoji would have.
function chatShapeOK(compose)
{
    const faces = compose.filter(e => e == '🙂' || e == '😍');
    if (compose.includes('❓')) return compose.length == 2 && !faces.length;
    // length >= 1 is implied: at least one non-face emoji means at least one
    return compose.length <= 2 && compose.length - faces.length >= 1;
}

// The one scorer (GDD 4). Taste is the reusable fact and carries
// SCORE_TASTE_WEIGHT of the total; overlap pays only when answering their
// prompt; staleness is what the message costs for repeating itself; a face
// scales the whole stake both directions (GDD 9), and their mood tilts what
// is left, last (GDD 3, chatMoodScale). The per emoji tapback reads
// the raw, unweighted taste - never the staleness, never the face - because
// that is the fact the player is collecting and it has to mean the same thing
// every time. Everything anybody ever says to anybody comes through here:
// compose and send, a date beat (dateReply), and running into them at their
// club (activityPick), so those three can never quietly disagree.
function chatScoreSend(c, emojis, face)
{
    const parts = emojis.map(e => ({e, taste: scoreTaste(e, c.opinions)}));
    let total = parts.reduce((n, {e, taste}) =>
        n + taste*SCORE_TASTE_WEIGHT - playerStale(c.seat, e) +
        (c.prompt ? scoreOverlap(e, c.prompt) : 0), 0);
    if (face == '🙂') total = total/2 | 0;
    if (face == '😍') total *= 2;
    return {parts, total: chatMoodScale(c, total)};
}

// what an emoji has ever earned from them: the best and the worst raw taste,
// which is what the Notes app prints and what the thread's own notebook
// sorts by (GDD 6). One record, written by every exchange that scores.
// Whichever emoji is the first to actually hit their best possible taste
// (c.top, characters.js) becomes their favourite (GDD 6, 9) - a tie is
// whichever one the player happens to send first, ||= never overwrites it.
function chatReact(c, e, taste)
{
    const rec = c.reactions[e];
    c.reactions[e] = rec ? [max(rec[0], taste), min(rec[1], taste)] : [taste, taste];
    if (taste == c.top)
        c.fav ||= e;
}

// One row per tapback, best first, holding every emoji whose best raw taste
// (GDD 6) earned that face - an emoji appears in exactly one row, and a face
// with nothing in it prints no row at all. The one renderer the journal (📓)
// and Notes both read, so the two can never quietly show different reactions
// for the same message (GDD 12). Filed under the same five faces the bubble
// pinned to each emoji, so the notebook says what the player actually saw:
// raw taste is the tapback's scale, and the message face ladder (scoreFaces)
// is for weighted totals, which would file everything under 🙂 and 😐.
function chatReactionRows(c)
{
    const seen = c.reactions;
    return chatTapbacks.map(([, face]) =>
    {
        const emojis = Object.keys(seen).filter(e => chatTapback(seen[e][0]) == face);
        return emojis.length ? `<div class="kbrow wrap rr"><span>${face}</span>` +
            emojis.map(e => `<div class=key style="width:54px">${e}</div>`).join('') +
            `</div>` : '';
    }).join('');
}

// the ★ once c.fav is actually found - the same mark the home tiles put on a
// slot still to spend (device.js), reused here for a favourite landed on
// instead (GDD 6, 9)
function chatFavHTML(c)
{
    return c.fav ? `<p class="h l"><span class=fav>★</span> favourite ` +
        `<span>${c.fav}</span></p>` : '';
}

function chatSend()
{
    if (!chatShapeOK(chatCompose))
        return;
    ++gameStats[0];   // Stats app: texts sent, scored sends only (GDD 5)

    // ❓ beside an emoji is the mercy valve (GDD 9): the emoji is sent and
    // scored like any text, and they also say why it landed the way it did
    const ask = chatCompose.includes('❓');
    const face = chatCompose.find(e => e == '🙂' || e == '😍') || '';
    const sent = chatCompose.filter(e => e != face && e != '❓');
    const result = chatScoreSend(chatContact, sent, face);

    // asking is asking (GDD 9): beside ❓ a bad guess scores nothing rather
    // than less - the tapback still says what they thought of it
    if (ask)
        result.total = max(0, result.total);

    chatContact.affection += result.total;
    chatLand(chatContact, result.total);
    // Stats app (GDD 12): how the texts have been landing
    if (result.total >= scoreFaces[1][0]) ++gameStats[3];
    else if (result.total < 0) ++gameStats[4];

    for (const {e, taste} of result.parts)
    {
        // They notice when you keep saying the same thing (GDD 4) - and one
        // emoji on its own wears at half the rate of a pair or of anything
        // with a face on it, which is the bare single emoji's one advantage.
        playerNote(chatContact.seat, e, sent.length + !!face);
        chatReact(chatContact, e, taste);
    }

    // They answer once, in one bubble: how the whole message landed, and
    // beside it something of their own, which is half your evidence and now
    // the player can actually see them say it (GDD 5, 6). Two bubbles read as
    // two people talking. The tapback per emoji is raw taste, the fact the
    // player reuses; the face is the scaled total the face just bought (GDD 4).
    // The prompt is re-rolled after the scoring, so the overlap it paid is
    // the one the thread was showing when the message was written.
    // a ❓ gets the why in place of their prompt, which still re-rolls for the row
    const why = ask ? ' 💭 ' + chatWhy(chatContact, sent[0]) : '';
    chatContact.prompt = scorePrompt(chatContact.opinions, chatContact.prompt, 1);
    chatPost(chatContact, sent, result, {text: scoreFace(result.total) +
        (why || (chatContact.prompt ? ' ' + chatContact.prompt : ''))});
    chatLearn(chatContact, chatContact.prompt);

    chatSpend(chatContact);
    chatCompose = [];
    playSound(result.total > 0 ? soundGood : result.total < 0 ? soundBad : soundTap);
}

// Every way of talking to them costs the week's one text - a reply to
// somebody who texted first included, which is the choice a week is (GDD 6,
// 9). Hearing from you at all is what neglect cares about (GDD 3).
// Asking somebody out goes through here too (dateSchedule), which is why it
// takes who rather than reading chatContact: the ask spends the same one
// action a text does, so it has to answer a waiting text the same way. It did
// not, and somebody you had just booked a Saturday with sat on the contact
// list all week still lit as waiting on a text the week no longer had room
// to send.
function chatSpend(c)
{
    c.incoming = 0;
    ++weekPhoneUsed;
    c.heard = 1;
}

// How much better a gift lands than the same emoji sent as a text (GDD 9) 📏.
// The smallest multiple at which giving somebody their favourite thing beats
// saying something good to them. SCORE_BEST_FLOOR guarantees every rolled
// person has a favourite worth at least 4, and test/sim.mjs puts an ordinary
// worked-out text at 20: five is what makes the weakest possible favourite
// match it, and a real one (taste 5 or 6) clear it. At the doubling this
// started on the same present was worth 8 - the one irreversible act in the
// game was the weakest thing you could do with a week, and no present could
// ever earn the top face. A misjudged one now costs up to 25, which is what
// makes it a move you have to have read them to make.
const CHAT_GIFT_MULT = 5;

// Giving an emoji away (GDD 9). It lifts out of your keyboard for good and
// leaves the empty slot behind, which is the whole point: they can see what it
// cost you, and so can you, every time you open the keyboard after. The tap
// that reaches here is always the second one - gameAction's 'gift' opens the
// are-you-sure modal first, because this is the only irreversible act in the
// game and the confirmation has to say so in words.
function chatGift()
{
    ++gameStats[2];   // Stats app: gifts given (GDD 5) - the confirmed give,
                      // gameAction's 'giftgo' is the only caller
    const emoji = chatCompose[0];
    const taste = scoreTaste(emoji, chatContact.opinions);
    let score = taste*CHAT_GIFT_MULT;
    if (chatContact == characters[2])
        score += 2;   // the artist keeps things (her quirk)

    score = chatMoodScale(chatContact, score);   // the same tilt a text gets (GDD 3)

    playerGive(chatContact.seat, emoji, gameWeek);
    chatPost(chatContact, [emoji], {parts: [{e: emoji, taste}], total: score},
        {text: scoreFace(score)});
    chatContact.affection += score;
    chatLand(chatContact, score);

    // the thing is gone, but what it told you about them is not (GDD 6): the
    // notebook and Notes both read this, and a present is evidence like any
    // other - the letter under the tree can still be the emoji you gave away
    chatReact(chatContact, emoji, taste);

    chatSpend(chatContact);
    chatCompose = [];
    playSound(score > 0 ? soundGood : soundBad);
}

// live on the compose keyboard: the week's one text is still there (a reply
// and a present both spend it, GDD 9 - with it gone the keyboard goes dead
// rather than letting a message be typed and then refused), and the key is
// owned, not already picked, not the thing they just showed you, and would
// still leave a legal message (chatShapeOK) - or is ❓ typed first, on its
// own, waiting for the emoji the question is about.
//
// Their prompt is dead while it is their prompt and back the moment it
// re-rolls (GDD 4). Overlap credits every word an emoji carries and nothing
// matches an emoji better than itself, and a prompt is always something they
// like - so with the echo allowed it was the best reply in the whole library
// in 16 seeds of 30, with nothing worked out at all.
function chatKeyLive(emoji)
{
    return calPhoneAvailable() && playerOwns(emoji) &&
        ![...chatCompose, chatContact.prompt].includes(emoji) &&
        (chatShapeOK([...chatCompose, emoji]) || emoji == '❓' && !chatCompose.length);
}

// tapping a key on the keyboard
function chatKey(emoji)
{
    if (!chatKeyLive(emoji))
        return;
    chatCompose.push(emoji);
    playSound(soundTap);
}

///////////////////////////////////////////////////////////////////////////////
// The contact list

function msgHTML()
{
    return `<h1>Messages</h1>` + hint(!calPhoneAvailable() ? "this week's text is spent" :
        chatWaiting() ? 'one text a week - and somebody is waiting on it' :
        'one text a week - pick someone') +

    // two lines a row: the name and the role, then the mood and what is on
    // their mind - with the bomb of a neglect two strikes in and the 🎂 of a
    // birthday you can still give on riding on the second (GDD 3, 9, 12).
    charMet().map(c => tap('chat', c.idx, 'row' + (c.incoming ? ' hot' : ''),
        rowBody(c.avatar(64),
        `<b>${c.name}</b><span>${c.role}</span>` +
        chatMoodLine(c, ' ' + calUpsetIcon(c) +
            (calGiftDay(c) && calPhoneAvailable() ? '🎂' : '')),
        c.incoming ? chatFoot(c, '💬 texted you') : chatFoot(c)))).join('');
}

///////////////////////////////////////////////////////////////////////////////
// One thread

function chatHTML()
{
    const c = chatContact;

    return `<div class=row>${button('msg', 0, '‹')}` +
        rowBody(c.avatar(56),
            `<b>${c.name}</b><span>${c.role}</span>` + chatMoodLine(c) +
                chatFavHTML(c),
            chatFoot(c)) +
        `${tap('journal', 0, 'btn', '📓')}</div>` +

    // The other thing a phone can do: spend the whole weekend on one person -
    // but not on a stranger, and not twice. There is one Saturday, so once it
    // is spoken for the offer goes away rather than quietly replacing the
    // person you already asked.
    // dateAskable (date.js) owns the whole gate - stranger, cooldown, and the
    // last week, which has no Saturday in it at all, only the tree. The lines
    // below only say why the offer is missing; they never decide it - so the
    // two weeks that have no weekend to talk about, a spent phone and the
    // last one, say nothing rather than blaming the tier for it.
    (dateContact ? hint(dateContact == c ? 'Saturday is already yours' :
        `Saturday is spoken for - you asked ${dateContact.name} out`) :
    !calPhoneAvailable() || gameWeek >= calWeeks - 1 ? '' :
    dateAskable(c) ? button('askout', 0, '🗓️ ask them out this weekend') :
    chatTier(c) >= 4 ? '' :   // a stranger gets no offer, and no line about it
    hint('too soon to ask them out again')) +

    (chatJournalOpen ? chatJournalHTML() : chatThreadHTML()) +
    chatComposeHTML() +
    // a spent phone shows no keyboard at all - a page of dead keys read as a
    // broken screen; the compose line above says why there is nothing to press
    (calPhoneAvailable() ? chatKeyboardHTML() : '');
}

function chatThreadHTML()
{
    const thread = chatContact.thread;
    if (!thread.length)
        return `<div class=thread><p class=h style="font-size:60px">👋</p></div>`;
    // the tapback shows taste only: what they think of the thing itself is the
    // reusable fact, and overlap belongs to the message, not the emoji (GDD 4)
    // - and ❓ is never in the bubble: the question is about the emoji beside it
    // All of it, oldest first: the thread is the notebook the game asks the
    // player to keep (GDD 6), and gameRender scrolls it to the newest message
    // on every repaint, so the rest of the year costs nothing to leave behind
    // it to scroll back through.
    return `<div class=thread>` + thread.map(msg => msg.mine ?
        `<div class="bub me">` + msg.emojis.map((emoji, e) =>
            `<u>${emoji}${msg.parts[e] ? '<s>' + chatTapback(msg.parts[e].taste) + '</s>' :
                ''}</u>`).join('') + `</div>` :
        `<div class="bub them">${msg.text}</div>`).join('') + `</div>`;
}

// The notebook inside a thread (📓): what you know about this one person,
// the very block their Notes card prints (chatNotesBody), so the two can
// never disagree. It reads told opinions and c.reactions, both of them
// saved, so unlike a scan of the thread it survives a reload (GDD 13).
function chatJournalHTML()
{
    return `<div class=list>` + hint('what you know about them') +
        chatNotesBody(chatContact) + `</div>`;
}

function chatComposeHTML()
{
    // a spent phone says so and shows nothing else - no slots to fill, no
    // keyboard to fill them from (GDD 6)
    if (!calPhoneAvailable())
        return hint('no texts left this week');

    // a present is the week's text too, offered when it is a day for one and
    // the line holds exactly one library emoji (GDD 9)
    const canGift = calGiftDay(chatContact) && chatCompose.length == 1 &&
        playerOwns(chatCompose[0]) && netByEmoji[chatCompose[0]];

    return `<div class=compose>
        <span class=h>message</span>` +
        [0, 1].map(i => tap('unpick', i, 'slot', chatCompose[i] || '')).join('') +
        (!chatCompose.length ? `<span class=h>tap emoji below</span>` :
            button('send', 0, chatContact.incoming ? '📤 reply' : '📤 send', 'go') +
            // the multiplier is printed on the thing that applies it (GDD 4),
            // and comes out of the constant so the words cannot drift from it
            (canGift ? button('gift', 0, `💝 give it away ×${CHAT_GIFT_MULT}`) : '')) +
    `</div>`;
}

// What you have, a row per club: live keys can be tapped, the rest are dead
// slots - a face that would not make a legal message, an emoji already on the
// line. What you have never owned is simply not there; a present is, as the
// empty slot it left behind for good, which is the point of giving it (GDD
// 9). A club with nothing in it has no row. The exam and the last day's
// letter reuse this grid too - a different "live" rule and a different
// action, an answer sheet rather than a compose keyboard (GDD 8, 11).
//
// The face row is labelled with what the faces cost instead of with a word
// like "tone": the only multipliers in the game are printed on the things that
// apply them (GDD 4), and this row is the thing that applies two of them. It
// has to stay inside the 52px the label column is (style.css .kbrow > span).
// The faces are the compose keyboard's own row and nobody else's: they halve
// or double a message and ask a question about one, and an exam answer or a
// letter under the tree is none of those things. Both of those grids run a
// live rule that only accepts library emoji, so the row was three permanently
// dead keys under a label advertising a multiplier that could not be spent -
// a rule of texting printed on a page that is not texting.
function chatKeyboardHTML(live = chatKeyLive, action = 'key')
{
    const mine = emoji => playerOwns(emoji) || playerGiven.some(g => g[1] == emoji);
    const rows = netClubs.map(club =>
        [club, netClub(club).filter(rec => mine(rec.e)).map(rec => rec.e)]);
    if (live == chatKeyLive)
        rows.unshift(['½ ×2 ask', playerFaces]);

    return `<div class=kb>` +
        rows.map(([name, emojis]) => emojis.length ?
            `<div class="kbrow wrap"><span>${name}</span>` +
            emojis.map(emoji => live(emoji) ?
                tap(action, emoji, 'key', emoji) :
                `<div class="key off">${emoji}</div>`).join('') + `</div>` : '').join('') +
    `</div>`;
}

///////////////////////////////////////////////////////////////////////////////
// The Notes app: what you have worked out about everyone you have met so far

// What you know about one person, and never a conclusion drawn for you (GDD
// 5): every opinion they have told you, in the order told, the ★ once a
// favourite is found, and every emoji they have reacted to, filed under the
// reaction (chatReactionRows). The one block both Notes and the notebook in
// a thread print, so the two can never disagree (GDD 6, 12).
function chatNotesBody(c)
{
    return chatIntelFacts(c) + chatFavHTML(c) +
        (Object.keys(c.reactions).length ? chatReactionRows(c) : hint('nothing sent yet'));
}

function notesHTML()
{
    return `<h1>Notes</h1>` +

    hint('what you have worked out about each of them') +
    charMet().map(c => `<div class="row ro">` +
        rowBody(c.avatar(56), `<b>${c.name}</b>` + chatNotesBody(c)) + `</div>`).join('');
}
