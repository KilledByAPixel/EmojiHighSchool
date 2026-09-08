/*
    The phone itself
    - the whole game is one high schooler's mobile device, so every screen is
      an app inside the same chrome: a status bar on top, a home bar below
    - the status bar carries the things you always need: what week it is and
      what season it is
*/

'use strict';

// month names for the Japanese school year, April through March
const deviceMonths = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const deviceSeasons = [['🌸','spring'],['☀️','summer'],['🍂','autumn'],['⛄','winter']];

// The home screen: one app icon per thing the phone can do. Six of them, in a
// three by two grid that fills the phone - the week is spent from here, so
// the tiles are the biggest thing on the screen (GDD 12).
const deviceApps =
[
    ['📅','Calendar', 'calendar'],
    ['💬','Messages', 'msg'],
    ['🎒','School',   'school'],
    ['😀','Emojis',   'dict'],
    ['📓','Notes',    'notes'],
    ['📊','Stats',    'stats'],
];

///////////////////////////////////////////////////////////////////////////////

// where in the year you are, as a date rather than a week count - the months
// are the same ones the calendar draws, three or four weeks each
function deviceDate()
{
    const [month, first] = calMonth();
    return `${deviceMonths[month]} ${(gameWeek - first)*7 + 1}`;
}

// The status bar, above every app: the date, the season, the week, the two
// switches and the battery.
//
// The week sits in the middle, growing into the gap that would otherwise be
// spacing the switches out to the right. It carries what the home screen
// would have to say itself, and every other screen gets it for nothing.
//
// The battery is the week itself: 🔋 while there is still something to do, 🪫
// once the club and the text are both spent and the weekend is all that is
// left, so the one-action economy shows without a word (GDD 6). Two glyphs,
// not a drawn bar: the drawn one cost ninety bytes for the same sentence. The
// low battery glyph is Unicode 14, which is why the font is our own build now.
function deviceBarHTML()
{
    return `<span>${deviceDate()}</span>
        <span>${deviceSeasons[calSeason()][0]}</span>
        <span class="r h">${deviceSeasons[calSeason()][1]} term - week ${
            gameWeek + 1} of ${calWeeks}</span>` +
        tap('mute', 0, '', audioEnabled ? '🔊' : '🔇') +
        tap('tune', 0, '', musicEnabled ? '🎵' : '🔕') +
        `<span>${domSafe(weekActivityUsed && weekPhoneUsed ? '🪫' : '🔋')}</span>`;
}

// The way back, on every screen except home and the ones you cannot leave.
// A house emoji rather than the house symbol U+2302: the symbol is not in
// Twemoji and rendered fine from the text font, but an emoji echoes the theme.
function deviceHomeBarHTML()
{
    return gameScreen == screenHome || gameScreen >= screenDateScene ? '' :
        button('home', 0, '🏠 home');
}

///////////////////////////////////////////////////////////////////////////////
// The home screen

// what you have not spent yet this week, in words
function homeUnspent()
{
    const left = [];
    if (!weekActivityUsed)
        left.push(calIsExam() ? 'the exam' : "this week's club");
    if (calPhoneAvailable())
        left.push(chatWaiting() ? 'a text to answer' : 'your one text');
    return left;
}

function homeHTML()
{
    return `<h1>Emoji High School</h1>` +

        `<div class=apps>` + deviceApps.map(([icon, name, action]) =>
        {
            // School and Messages are the two apps holding a slot, and they
            // say so: a ★ while the slot is still there, and once it is spent
            // the tile greys out with no mark on it at all - a tick was a
            // second thing to read on a tile that is already done with. Only
            // something waiting to be answered outranks the star.
            const waiting = action == 'msg' && chatWaiting();
            const holds = action == 'school' || action == 'msg';
            // only the two tiles holding a slot have a slot left to ask about
            const left = holds &&
                (action == 'school' ? !weekActivityUsed : calPhoneAvailable());
            return tap(action, 0, 'app' + (holds && !left && !waiting ? ' off' : ''),
                `<b>${icon}${waiting ? '<s>🔴</s>' : left ? '<s>★</s>' : ''}</b>` +
                `<i>${name}</i>`);
        }).join('') + `</div>` +

        // only when there is something to say: a line explaining what a week
        // is belongs in the first week, not in all forty
        (chatWaiting() ? hint('someone texted you') :
            !calPhoneAvailable() && weekActivityUsed ?
            hint('nothing left this week - time for the weekend') : '') +

        (dateContact ? hint(`Saturday: ${dateName(dateLocation)} with ` +
            `${dateContact.name}`) : '') +

        // The way out of the week, and it sits directly under the apps: the
        // cards below are a week's worth of news and on a loud week they run
        // past the bottom of the phone, which left the one control that ends
        // the week as the thing you had to scroll to find. Everything under
        // it is for reading; this is the only thing on the screen that moves
        // the year on, so it goes where the thumb already is.
        //
        // It reads as the thing to do next once the week is spent, and as the
        // thing you are probably not ready for while it is not - the same
        // button either way, greyed while a slot is unspent, and gameAction
        // asks first then. A date already booked always wins - the weekend is
        // one or the other, never both (GDD 10) - otherwise it is a trip,
        // alone, and never lost: skipping ahead costs the slots, not the
        // Saturday.
        button('week', 0, gameWeek >= calWeeks - 1 ? '🌳 go to graduation' :
            dateContact ? `${dateLocation} go on the date` : '🧳 go out for the weekend',
            homeUnspent().length ? 'off' : 'go') +

        // The emoji font, which js13k will not let the game fetch for itself
        // (GDD 2). The offer leads the cards every week until it is taken,
        // because a phone made of nothing but emoji is the wrong place to
        // hide it: on the title screen it was one tap from being scrolled
        // past forever, and a player who misses it plays the whole year in
        // their own device's emoji without ever knowing there was a choice.
        // It is a .row and not a .card because a card is something to read
        // and a row is something to tap: the row already carries the pointer
        // and the press, so the one thing on this screen meant to be tapped
        // costs no stylesheet of its own.
        (domFontOn ? '' : tap('font', 0, 'row', rowBody(glyph('🌈', 38),
            `<b>load Twemoji font</b>`))) +

        // the reminders, under the apps all week: what the week is, what
        // happened over the weekend, and who you ran into at a club
        calRemindersHTML() +
        // Who turned up where you went, what you showed them, and - the point
        // of the card - how it landed, which is a whole reaction earned for
        // nothing. The club named is the one YOU spent the week at, read off
        // the emoji you learned there: the encounter is a draw over everyone
        // you have met (GDD 7), so the face beside it is usually not the one
        // whose own club this is - and the night owl's word is not a club at
        // all, so hers would have left the sentence with a hole in it.
        (activityMet ? card(activityMet[0].avatar(38),
            `ran into ${activityMet[0].name} at ${netByEmoji[activityMet[1]].club} club`,
            `${glyph(activityMet[1] + ' ' + activityMet[2], 22)} - ` +
            `see it in your chat`) : '');
}

///////////////////////////////////////////////////////////////////////////////
// The Emoji app: the dictionary (GDD 5) - every library emoji, grouped by
// club or colour, whichever view is open. Owned ones read out in words; what
// is left in a group collapses to a single count, so the shape of what is
// missing stays visible but its contents do not. This is the only place an
// emoji can be inspected - no tap target on a row, and none added anywhere
// else (GDD 5: "one app, one place"). Not saved: it always opens on club.
let dictView = 0;   // 0 club, 1 colour

// One group's own slice: a heading, its owned rows, then what is left of it
// as a single count. Never empty: every word in either vocabulary owns
// seven emoji or more, so there is always a row or a count to show.
// The view picks the field with a function rather than by name: a string key
// means a bracket read into a record whose keys Closure ADVANCED renames
// (network.js, netInit), which found nothing at all in the built bundle and
// left the whole dictionary blank in both views - the same hazard netPlaces'
// quoted keys guard against, arriving from the other side.
function dictGroupHTML(pick, word)
{
    const group = netLib.filter(r => pick(r) == word);
    const owned = group.filter(r => playerOwns(r.e));
    const missing = group.length - owned.length;
    return `<h2>${word}</h2>` +
        owned.map(r => `<div class="row ro">` + iconLine(r.e,
            [r.club, r.colour, r.tags.join(', ')].filter(String).join(' · ')) +
            `</div>`).join('') +
        (missing ? iconLine('▫️', `${missing} more to find`) : '');
}

function dictHTML()
{
    const pick = dictView ? r => r.colour : r => r.club;
    return `<h1>Emojis</h1>` +
        hint(`${playerCount()} of ${netLib.length} learned`) +

        `<div style="display:flex;gap:8px">` +
        button('dictview', 0, 'club', dictView ? '' : 'go') +
        button('dictview', 1, 'colour', dictView ? 'go' : '') +
        `</div>` +

        (dictView ? netColours : netClubs).map(word => dictGroupHTML(pick, word)).join('');
}

///////////////////////////////////////////////////////////////////////////////
// The Stats app: how the run is going - counters, not a per-character list,
// which already lives in Messages as the affection foot on every row (GDD 5).
// The Stats app (GDD 12): the run at a glance - the week, how the texts have
// landed, the weekend's tally, the exams, how much of the library is learned,
// the seed, and then the collection itself. Deliberately no row per
// classmate: their hearts and their rung are on every row of Messages
// already, which is where somebody looking for them looks. Only the two text
// counters are kept for this screen; the rest is read off what the game
// already holds.
function statsHTML()
{
    const [texts, dates, gifts, good, bad] = gameStats;
    return `<h1>Stats</h1><div class=stats>` +
        iconLine('🗓️', `week ${gameWeek + 1} of ${calWeeks}`) +
        iconLine('💬', `${texts} texts - ${good} landed, ${bad} missed`) +
        iconLine('💘', `${dates} dates, ${gifts} presents`) +
        iconLine('📝', `${calExamResults.filter(r => r).length} of ` +
            `${calExamResults.length} exams passed`) +
        iconLine('📚', `${playerCount()} of ${netLib.length} emojis found`) +
        hint(`seed ${gameSeed}`) + `</div>` +

        // And the collection itself, which is the one screen that shows a
        // year's work at a glance. In colour order rather than library order,
        // which puts the reds together and the greens together: the wall reads
        // as a picture of what you have rather than a list, and colour is the
        // one attribute you can see without being told (GDD 2). The Emojis app
        // is where one can actually be read (GDD 5); this is only the wall.
        `<div class="kbrow wrap">` + netLib.filter(rec => playerOwns(rec.e))
            .sort((a, b) => netColours.indexOf(a.colour) - netColours.indexOf(b.colour))
            .map(rec => `<div class=key>${rec.e}</div>`).join('') + `</div>`;
}

// nothing carries over to next week, so spending a slot is now or never.
// gameConfirm also gates the gift are-you-sure below - 2 means a gift is
// waiting on its second tap, the only irreversible act in the game (GDD 9)
function confirmHTML()
{
    // the multiplier is printed on the thing that applies it (GDD 4), out of
    // the constant itself so the words cannot drift from the number
    if (gameConfirm == 2)
        return `<div>
            <p style="font-size:44px">🎁</p>
            <h1>Give this away?</h1>
            ${hint(`Worth ×${CHAT_GIFT_MULT} what saying it is.`)}
            ${hint('It leaves your keyboard for good.')}
            <div class=btns>${button('cancel', 0, 'cancel', 'off')}
                ${button('giftgo', 0, 'give it', 'go')}</div>
        </div>`;

    // what it costs, said outright: the unspent slots, which do not carry
    // over - the weekend itself is never the price (GDD 10)
    return `<div>
        <p style="font-size:44px">🛌</p>
        <h1>Skip to the weekend?</h1>
        ${hint('You still have ' + homeUnspent().join(' and '))}
        <div class=btns>${button('cancel', 0, 'cancel', 'off')}
            ${button('endweek', 0, 'skip ahead', 'go')}</div>
    </div>`;
}
