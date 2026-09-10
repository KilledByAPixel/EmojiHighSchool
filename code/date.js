/*
    Dates (GDD section 10)
    - asking someone out spends the week's one phone action, and the date
      itself happens in the weekend slot: the whole week, on one person
    - a date is three beats. The first two, they open with something of
      theirs and you answer with a single emoji, same as a text. The third
      is the place's own signature moment: it prompts with its own glyph, and
      the reply is scored on overlap with its attributes alone, because a
      place has no taste
    - the place is public information: the attributes it favours, and the
      bonus for packing them, are printed on the screen, so context never
      hides anything
    - a trip is the other way to spend the weekend: go alone, and come home
      with an emoji that carries the place's attributes instead of a person's
*/

'use strict';

const dateBeats = 3;

// What the place does to a reply that carries one of its own attributes, on
// every beat (GDD 10) 📏. This is public information, so it is the part of a
// date a player who knows nothing scores just as well as one who knows
// everything: at +3 a guessing player reaches 😍 in a quarter of years against
// a worked-out one's 95%, and at +1 it is a rounding error on a beat and the
// place stops being worth choosing. Two is 6 points of a 27-point date, which
// is worth choosing without paying the people who cannot read anything else.
const DATE_PLACE_BONUS = 2;   // 📏

let dateContact;       // who you asked out, nothing planned when this is 0
let dateLocation;      // where you are taking them
let dateThread = [];   // this weekend's exchange, them and you alternating
let dateTotal = 0;     // how it is going, in score
let tripPlace = '';    // where the weekend is going: set on its first tap, kept for the week

///////////////////////////////////////////////////////////////////////////////

// Where you can go this week: always the same six, in the same order, in the
// same places on the grid. Some places only exist in one season and two only
// on their one week of the year, and none of them JOINS the list - each one
// stands in for a permanent place and takes its tile (network.js, netPlaces).
// So the weekend is the same shaped decision all year and a season is a
// trade rather than a free extra tile - six tiles, never a ragged last row.
function dateLocations()
{
    const open = Object.keys(netPlaces).filter(location =>
    {
        const when = netPlaces[location][2];
        return when != undefined &&
            (when < 0 ? calEvent() == location : when == calSeason());
    });
    return Object.keys(netPlaces).filter(l => netPlaces[l][2] == undefined)
        .map(l => open.find(o => netPlaces[o][3] == l) || l);
}

function dateName(location) { return netPlaces[location][0]; }

// what the place favours, in words
function dateBadge(location) { return netPlaces[location][1].join(' and '); }

// an emoji carrying any of the place's own attributes pays a flat bonus,
// whichever beat it lands on (GDD 10) - exact carry, the same "hit" a club or
// tag word ever pays, not a near miss
function datePlaceBonus(emoji, place)
{
    const rec = netByEmoji[emoji];
    return rec && netPlaces[place][1].some(word => scoreDist(rec, word) == 0) ?
        DATE_PLACE_BONUS : 0;
}

// Asking out (GDD 9): not a stranger, not the same person two weekends
// running - the cooldown reads the week they were last taken out - and not
// on the last week, when there is no Saturday left.
function dateAskable(character)
{
    return chatTier(character) < 4 && gameWeek < calWeeks - 1 &&
        gameWeek - character.lastDate > 1;
}

// spend the phone action on the weekend instead of a text
function dateSchedule(character, location)
{
    if (!dateAskable(character))
        return;
    dateContact = character;
    dateLocation = location;

    // The ask is the week's one phone action, so it spends it exactly the way
    // a text does: it counts as hearing from you (GDD 3), and it answers a
    // text of theirs that was waiting (GDD 9). Taking only the slot would
    // leave somebody you had just made plans with lit on the contact list,
    // waiting for a text the week no longer has room for.
    chatSpend(character);

    // and it reads as the conversation it was: where you asked them to go,
    // and them saying yes. Anyone the phone will let you ask says yes -
    // dateAskable above is the whole gate - so the answer is never in doubt,
    // and the bubble is there to record the ask, not to hold its outcome.
    chatPost(character, [location], {parts: []}, {text: '👍'});
    playSound(soundGood);
}

///////////////////////////////////////////////////////////////////////////////

// the weekend arrives
function dateStart()
{
    dateThread = [];
    dateTotal = 0;
    chatOpen(dateContact);  // a date types on the same keyboard as a text
    dateAsk();
}

// the first two beats: they open with something of theirs, the same weighted
// draw that opens a text. The third beat is the place's own: it has no taste
// to show, so its own glyph is the prompt (GDD 10).
function dateAsk()
{
    const beat = dateThread.filter(msg => msg.them).length;
    if (beat < dateBeats - 1)
    {
        dateContact.prompt = scorePrompt(dateContact.opinions);
        dateThread.push({them: 1, emoji: dateContact.prompt});
    }
    else
        // the place is asking now, not them - but their prompt is left
        // standing, because it is still the last thing they showed you and a
        // text next week is still answering it (GDD 4)
        dateThread.push({them: 1, emoji: dateLocation, place: 1});
}

// Answer the beat with one emoji - the same verb as a text (GDD 4), scored by
// the same function: beats one and two are chatScoreSend with no face on them.
// The place's own beat scores on overlap with its attributes alone, with no
// taste in it at all (GDD 10). The keyboard here only ever offers library
// emoji (dateSceneHTML), so there is no face to guard against.
function dateReply(emoji)
{
    // a legal beat is owned, and never the thing they just showed you (GDD
    // 4) - this beat's own prompt and only that: on the place beat it is the
    // place, which is not on the keyboard anyway, so beat two's emoji is not
    // held back for nothing. The keyboard (dateSceneHTML) shows the same rule.
    const last = dateThread[dateThread.length - 1];
    if (!last || !last.them || !playerOwns(emoji) || emoji == last.emoji)
        return;

    const bonus = datePlaceBonus(emoji, dateLocation);
    let total, taste;
    if (last.place)
    {
        taste = 0;
        total = scoreOverlapAttrs(emoji, netPlaces[dateLocation][1]) + bonus;
    }
    else
    {
        const scored = chatScoreSend(dateContact, [emoji], '');
        taste = scored.parts[0].taste;
        total = scored.total + bonus;

        // the place's own beat has no taste to record (taste is 0 above, on
        // purpose) - only the two beats that are actually them feed the
        // notebook and Notes, the same fact every other path that scores
        // writes (GDD 4, 6)
        chatReact(dateContact, emoji, taste);
    }

    // the place field rides along on the reply too, so the render can tell
    // which bubble to score as a face instead of a plain taste tapback
    dateThread.push({emoji, score: total, taste, place: last.place});
    dateScore(total);
    playerNote(dateContact.seat, emoji, 1);   // a beat is one emoji, said plainly
    playSound(total > 0 ? soundGood : total < 0 ? soundBad : soundTap);

    if (dateThread.length < dateBeats*2)
        dateAsk();
}

function dateScore(score)
{
    dateTotal += score;
    dateContact.affection += score;
}

// the walk home, and the end of the week
function dateFinish()
{
    ++gameStats[1];   // Stats app: dates gone on (GDD 5)
    // How the day went is the week they wake up to (GDD 3). Both of their
    // beats answered with something they love - two ❤️ on the screen - leaves
    // them 🥰, the one thing that does, and it holds until a text misses.
    // That is raw taste, on purpose: the place beat is public information
    // and the total is inflated by the place bonus and by the mood itself,
    // so a bar on the total let a player who knew nothing date their way
    // into 🥰 and then stay there on the ×1.5 (the sim put the know-nothing
    // player's letters at 24 of 60, against 5). A day that merely went well
    // is a bright Monday; a bad one is gloomy, or stays 😡, since a bad date
    // is no way to take the edge off that.
    if (dateThread.every(msg => msg.them || msg.place || msg.taste >= SCORE_GOOD))
        dateContact.mood = 2;
    else if (dateTotal >= dateBeats)
        dateContact.mood = 1;
    else if (dateTotal < 0)
        dateContact.mood = min(dateContact.mood, -1);

    // and the others hear about it (GDD 10): anyone crushing on you who was
    // not the one you took out wakes up 😡, and says so in their own thread -
    // the mood that holds until you text them, so a weekend spent on one
    // person is a week owed to another. Friends do not mind; crushes do.
    for (const c of characters)
        if (c != dateContact && chatTier(c) <= 1)
            c.mood = -2, c.thread.push({them: 1, text: '😡'}),
            calNewsNext.push([c.idx, `${c.name} heard about your Saturday`,
                '😡 until a text of yours lands']);

    dateContact.heard = 1;       // a date is a whole weekend of attention (GDD 3)
    dateContact.lastDate = gameWeek;   // starts the ask-out cooldown (GDD 9)
    dateContact = 0;
    calEndWeek();
}

function dateOver() { return dateThread.length >= dateBeats*2; }

///////////////////////////////////////////////////////////////////////////////
// Picking a place, which is the whole decision - the rest is conversation

function datePickHTML()
{
    return `<h1>Ask out ${chatContact.name}</h1>` +
        hint('a date spends this week\'s text and your weekend') +

        `<div class=apps>` + dateLocations().map(location =>
            tap('setdate', location, 'app',
                `<b>${location}</b><i>${dateName(location)}</i>` +
                `<p class=h>${dateBadge(location)}</p>`)).join('') + `</div>`;
}

///////////////////////////////////////////////////////////////////////////////
// The date itself

function dateSceneHTML()
{
    const over = dateOver();
    const last = dateThread[dateThread.length - 1];

    return `<div class=row>` + rowBody(dateContact.avatar(56),
        `<b>${dateName(dateLocation)}</b>
        <p class="h l">with ${dateContact.name} - ${dateBadge(dateLocation)}
        pays +${DATE_PLACE_BONUS}</p>`,
        `<b>${dateLocation}</b>`) + `</div>` +

        // every beat gets a reaction, never a silent one: the first two read
        // their raw taste, the place's own beat has none to read so it reads
        // its own score instead - the "no taste" rule is about scoring the
        // affection swing, not about muting the one piece of feedback (GDD 10)
        `<div class=thread>` + dateThread.map(msg => msg.them ?
            `<div class="bub them">${msg.emoji}</div>` :
            `<div class="bub me"><u>${msg.emoji}` +
            `<s>${msg.place ? scoreFace(msg.score) : chatTapback(msg.taste)}</s></u></div>`)
            .join('') + `</div>` +

        (over ?
            card(glyph(scoreFace(dateTotal), 44),
                dateTotal >= dateBeats ? 'a day to remember' :
                dateTotal >= 0 ? 'a nice enough day' : 'that went badly',
                `${dateTotal >= 0 ? '+' : ''}${dateTotal} with ${dateContact.name}`) +
            button('dateend', 0, '👋 walk home', 'go') :

            // the one place the game has to say what a good answer even is:
            // a date is a conversation, so replying to what they just showed
            // you counts for something on top of whatever they think of it -
            // except the last beat, which is the place talking, not them
            hint('answer with one emoji') +
            hint(last.place ?
                `something that carries what ${dateName(dateLocation)} favours` :
                `something that goes with their ${last.emoji}, or something they love`) +

            // the exam's rule, not compose's: a date is answered with one
            // plain emoji, and ❓ has nothing to ask here - offering it would
            // spend a beat of three on nothing at all (GDD 10)
            chatKeyboardHTML(e => calExamKeyLive(e) && e != last.emoji));
}

///////////////////////////////////////////////////////////////////////////////
// Trips (GDD 10): go alone, and come home with one of three emoji you do not
// own that carry the place's own attributes - the same verb as school, aimed
// at a different shelf: a club hands you a category, a trip hands you a word.

// what a place offers this week: unowned emoji carrying any of its
// attributes, rotated by a seed stable for the week so leaving and coming
// back cannot reroll it - the same door activityChoices uses for a club
function dateTrip(place)
{
    const attrs = netPlaces[place][1];
    return playerOffers(netLib.filter(rec =>
        attrs.some(word => scoreDist(rec, word) == 0)).map(rec => rec.e),
        gameWeek*3 + Object.keys(netPlaces).indexOf(place));
}

// places worth a trip this week: open the same way a date's are (season, or
// their one week), and with something left to offer - a place with nothing
// left is not listed, the same standard an empty club uses (GDD 7, 10)
function dateTripPlaces()
{
    return dateLocations().filter(place => dateTrip(place).length);
}

// Somebody is there (GDD 10): the same draw school runs, weighted by the
// strongest thing each of them feels about what the place is for. Where you
// go tilts who turns up without ever settling it - the beach is likelier to
// hand you whoever loves `sea`, and never certain to.
function dateTripWho(place)
{
    return charEncounter(c => max(...netPlaces[place][1].map(word =>
        (c.opinions.find(([a]) => a == word) || [0, 0])[1])));
}

// picking one is the whole decision, the same verb as school (GDD 10) - and
// if somebody is there, the thing you came home with is what you showed them
function dateTripPick(emoji)
{
    playerUnlock(emoji);
    const who = dateTripWho(tripPlace);
    if (who)
        calNewsNext.push([who.idx, `ran into ${who.name} at ${dateName(tripPlace)}`,
            `${emoji} ${calRunIn(who, emoji)} - in your chat`]);
    playSound(soundGood);
}

// The trip picker: which place, then which of its three offers - the same
// two-step door as School's club and its three (GDD 7, 10): the place is set
// the moment it is tapped, there is no way back to the list that week, and
// leaving and coming back lands on its three offers again. Only the offer
// spends the weekend. Unlike a date this is over in one tap, so there is no
// scene to be locked into: the home bar stays up the whole time (game.js).
function dateTripHTML()
{
    if (!tripPlace)
    {
        const places = dateTripPlaces();
        return `<h1>Go out for the weekend</h1>` +
            hint('go alone, and come home with something the place favours') +

            // staying in is the way out of a weekend with nothing in it, and
            // only that: with places on offer the weekend is a trip, and a
            // button to shrug it away would be a free way to skip the one
            // decision the weekend is (GDD 10)
            (places.length ?
                `<div class=apps>` + places.map(place =>
                    tap('triplace', place, 'app',
                        `<b>${place}</b><i>${dateName(place)}</i>` +
                        `<p class=h>${dateBadge(place)}</p>`)).join('') + `</div>` :
                hint('nowhere has anything left to offer this weekend') +
                button('tripskip', 0, '🛌 stay in instead', ''));
    }

    const offers = dateTrip(tripPlace);
    return `<h1>${dateName(tripPlace)}</h1>` +
        hint(`favours ${dateBadge(tripPlace)} - the weekend is set, pick one to come home with`) +
        `<div class=picks>` + offers.map(emoji =>
            tap('tripgo', emoji, 'pick', `<b>${emoji}</b>`)).join('') + `</div>`;
}
