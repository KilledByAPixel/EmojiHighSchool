/*
    Emoji High School
    - js13k dating sim, see emoji-high-school-gdd.md
    - the phone is HTML: screens are strings, and the game re-renders only when
      something changes, so there is no frame loop anywhere in here
*/

'use strict';

// screens (GDD 12) - anything from screenDateScene on is a place you cannot
// walk out of, so the home bar disappears there. screenTrip sits before it on
// purpose: picking a place and browsing its offers is still just browsing,
// nothing is spent until an offer is actually tapped (GDD 10)
const screenTitle = 0, screenHome = 1, screenCalendar = 2, screenActivity = 3,
    screenContacts = 4, screenChat = 5, screenNotes = 6, screenDict = 7,
    screenStats = 8, screenDate = 9, screenTrip = 10, screenDateScene = 11,
    screenEnd = 12, screenEnding = 13;

// what each screen paints, in that order - the title paints itself, and home
// is what anything without an entry falls back to
const screenHTML = [, homeHTML, calendarHTML, activityHTML, msgHTML, chatHTML,
    notesHTML, dictHTML, statsHTML, datePickHTML, dateTripHTML, dateSceneHTML,
    endTreeHTML, endingHTML];

// the run seed: it rolls every opinion, so it is the whole puzzle and the end
// screen prints it for sharing (GDD 4 and 11)
let gameSeed = 0;
let gameScreen = screenTitle;
let gameConfirm = 0;
let titleFresh = 0;   // the title's are-you-sure state for starting over
let gameStats = [0, 0, 0, 0, 0];   // [texts, dates, gifts, landed, missed] this run - Stats app, GDD 12

///////////////////////////////////////////////////////////////////////////////

function gameInit()
{
    gameSwitchLoad();
    netInit();
    if (!gameLoad())
        gameStart(randInt(1e6));
    gameScreen = screenTitle;
    domInit();

    const title = byId('t');
    title.onclick = e =>
    {
        // the small line under "carry on" abandons the year - but only when
        // tapped twice, because there is no way back from it
        if (e.target.closest('.fresh'))
        {
            if (!titleFresh)
                return titleFresh = 1, gameRender();
            gameStart(randInt(1e6));
            gameSave();
        }
        titleFresh = 0;
        gameScreen = screenHome;
        playSound(soundTap);
        gameRender();
    };
    gameRender();
}

// A fresh school year on this seed - same seed, same opinions, same puzzle.
// The keyboard is dealt first and the cast second, and initCharacters reseeds:
// so a seed's puzzle is the same puzzle whatever else the seed was spent on.
// The year opens quiet (GDD 9): it used to open with somebody already texting,
// which put a message on the phone before the player knew what a message was.
// The first opener now arrives on the ordinary draw, once somebody has a
// reason to reach out.
function gameStart(seed)
{
    gameSeed = seed;
    netSetSeed(seed);
    initPlayer();
    playerStart();
    initCharacters(seed);

    gameWeek = weekActivityUsed = weekPhoneUsed = 0;
    gameStats = [0, 0, 0, 0, 0];
    examResult = '';
    endWith = endCandidate = dateContact = gameContinued = 0;
    activityMet = 0;
    activityClub = activityLearned = tripPlace = '';   // the last week never ends,
                                       // so never clears its own picks (GDD 7, 10)
    calForcedClub = '';
    calExamQ = [];
    calExamAt = calExamPassed = 0;
    calExamResults = [];
    calGifts = [];
    calNews = calNewsNext = [];
    gameScreen = screenHome;
}

///////////////////////////////////////////////////////////////////////////////
// The save (GDD 13): one snapshot at the end of every week, so the tab can be
// closed on a Tuesday and opened again on Thursday.
// Everything not in here is derived: the opinions come back from the seed, and
// the looks and the network are constants.

let gameContinued = 0;   // this run was picked up rather than started

// The key carries a number: bump it whenever the shape of the save changes,
// and a save from before is simply not found, rather than half loaded with
// fields that no longer mean what they did.
const gameSaveKey = 'emojiHigh7';

// The three little switches - sound, music, and the emoji font (dom.js) -
// live on their own tiny keys, read once at boot and written once per tap,
// never through gameSave(). The sound one used to piggyback on the week
// snapshot, but that was the only thing left calling gameSave() outside
// gameStart and calEndWeek, and it sits on almost every screen: with the
// lean v2 shape (GDD 13), a mid-week mute+reload would have refunded this
// week's spent actions and dropped a booked date - repeatably, for free.
// The two sound switches default ON and the font defaults OFF: an absent 'f'
// is the js13k-legal state, and only a tap on the title screen ever writes it.
// (A bitfield over one key was tried and measured at a single byte, which is
// not worth resetting everybody's sound preference to collect.)
// The keys are written in brackets, the same hazard netPlaces and the dataset keys
// guard against: Closure ADVANCED renames a dotted property, so a dotted key
// here would be a different, freshly renamed key on every build.
function gameSwitchLoad() { try { audioEnabled = localStorage['m'] != 0;
    musicEnabled = localStorage['u'] != 0;
    domFontSet(localStorage['f'] > 0); } catch (e) {} }
function gameSwitchSave() { try { localStorage['m'] = +audioEnabled;
    localStorage['u'] = +musicEnabled; localStorage['f'] = +domFontOn; } catch (e) {} }

// What v2 actually needs, and nothing it can regenerate (GDD 13). Dropped
// against the fields the first pass was still carrying: weekActivityUsed and
// weekPhoneUsed are always 0 by the time calEndWeek saves; dateContact and
// dateLocation are always cleared by then too (a date has already finished,
// or was never booked); thread is flavour, replayed rather than remembered;
// mood (GDD 3) is the one thing about their week that carries, so it is
// here; audioEnabled moved to its own key, above.
// reactions (the Notes data) and
// lastDate (the ask-out cooldown) are new here and load-bearing - the first
// pass left both out, which was the actual bug this shape fixes. fav is the
// one field that is not seed-derived and not a scan of reactions either -
// once found it has to survive a reload on its own (GDD 6, 9, 13).
function gameSave()
{
    // Never in the middle of a date. Every beat has already been added to
    // their affection, so a snapshot taken here and reloaded would hand back
    // a Saturday that had already been half spent, and let it be played out
    // again on top of what it paid the first time. gameStart's fresh-run
    // saves and calEndWeek are the only other callers - nothing mid-week
    // calls this any more.
    if (gameScreen == screenDateScene)
        return;

    try
    {
        localStorage[gameSaveKey] = JSON.stringify([gameSeed, gameWeek,
            playerKeyboard, playerSent, playerGiven,
            calExamResults, calForcedClub, calNews, calGifts, gameStats,
            characters.map(c => [c.affection, c.quiet, c.strikes, c.told,
                c.incoming, c.lastDate, c.prompt, c.reactions, c.fav, c.mood])]);
    }
    catch (e) {} // a phone with no room, or a browser with no storage
}

function gameLoad()
{
    try
    {
        const save = JSON.parse(localStorage[gameSaveKey]);
        gameStart(save[0]);

        let people;
        [, gameWeek, playerKeyboard, playerSent, playerGiven,
            calExamResults, calForcedClub, calNews, calGifts, gameStats,
            people] = save;

        // everything else - opinions, the library - is already right:
        // gameStart(save[0]) just replayed the same seeded roll order
        people.forEach((data, i) =>
        {
            const character = characters[i];
            [character.affection, character.quiet, character.strikes,
                character.told, character.incoming, character.lastDate,
                character.prompt, character.reactions, character.fav,
                character.mood] = data;

            // Threads are flavour and are not saved (GDD 13) - what an emoji
            // earned lives in reactions, which is what the notebook and Notes
            // both read. The one bubble that is not flavour is an unanswered
            // incoming: the text still waiting on the player's own (GDD 9), so it
            // is rebuilt from their saved prompt and mood, cold if that is
            // what it was - the same one bubble chatIncoming writes.
            character.thread = character.incoming ?
                [{them: 1, text: chatOpener(character) + character.prompt}] : [];
        });
        return gameContinued = 1;
    }
    catch (e) {} // nothing saved, or a save from a version that no longer fits
}

///////////////////////////////////////////////////////////////////////////////
// Everything the player can tap, in one place

function gameAction(action, arg)
{
    if (action == 'home')
        gameScreen = screenHome;
    else if (action == 'calendar')
        calShowMonth = calMonth()[0], gameScreen = screenCalendar;
    else if (action == 'month')   // clamped: the arrow past either end is a ghost
        calShowMonth = clamp(+arg, 0, calMonthWeeks.length - 1);
    else if (action == 'notes')
        gameScreen = screenNotes;
    // which view you were last in is not saved, so it opens on club (GDD 12)
    else if (action == 'dict')
        dictView = 0, gameScreen = screenDict;
    else if (action == 'dictview')
        dictView = +arg;
    else if (action == 'stats')
        gameScreen = screenStats;

    // the sound switch: its own key, not the week save (GDD 13) - it sits on
    // almost every screen, and gameSave() must never fire mid-week
    else if (action == 'mute')
        audioEnabled = !audioEnabled, gameSwitchSave();
    // and the music, which is its own switch: plenty of people want the taps
    // without the tune, and plenty want it the other way round (music.js)
    else if (action == 'tune')
        musicEnabled = !musicEnabled, gameSwitchSave(), musicPlay();
    else if (action == 'msg')
        gameScreen = screenContacts;

    else if (action == 'school')
        gameScreen = screenActivity;   // an exam week shows the exam instead;
                                       // a spent week shows what you learned
    // the exam: start a sitting, answer each question off the keyboard, then
    // step past the graded result - the week's slot is not spent until the
    // whole sitting is (calExamStart), so leaving and coming back resumes it
    else if (action == 'exam')
        calExamStart();
    else if (action == 'examkey')
        return calExamAnswer(arg), gameRender();
    else if (action == 'examnext')
        calExamNext();   // the third question's "see result" lands on the
                          // exam's own summary screen - 'home' leaves it
    // school: the club is set for the week on its first tap, and one of its
    // offers learned on the next, which lands you back home - the page then
    // reopens as the reminder of what was kept (GDD 7)
    else if (action == 'club')
        activityClub ||= arg;
    else if (action == 'pick')
    {
        if (!weekActivityUsed)
            activityPick(arg), gameScreen = screenHome;
    }

    else if (action == 'chat')
        chatOpen(characters[arg]), gameScreen = screenChat;

    else if (action == 'journal')
        chatJournalOpen = !chatJournalOpen;

    // the same keyboard types both a text and a date reply
    else if (action == 'key')
    {
        gameScreen == screenDateScene ? dateReply(arg) : chatKey(arg);
        return gameRender();
    }
    else if (action == 'unpick')
        chatCompose.splice(arg, 1);
    else if (action == 'send')
        return chatSend(), gameRender();
    // giving something away is the one irreversible act in the game, so a
    // tap on the compose screen only opens the are-you-sure modal - the
    // second tap, 'giftgo', is the one that actually spends it (GDD 9)
    else if (action == 'gift')
        return gameConfirm = 2, playSound(soundTap), gameRender();
    else if (action == 'giftgo')
        return gameConfirm = 0, chatGift(), gameRender();

    // ending the week throws away whatever you did not use, so ask first
    else if (action == 'week')
    {
        if (homeUnspent().length)
            return gameConfirm = 1, playSound(soundBad), gameRender();
        return gameEndWeek(), playSound(soundTap), gameRender();
    }
    else if (action == 'cancel')
        gameConfirm = 0;
    else if (action == 'endweek')
        gameConfirm = 0, gameEndWeek();

    // dates: asked for on the phone, spent on the weekend (GDD 8)
    else if (action == 'askout')
        gameScreen = screenDate;
    else if (action == 'setdate')
        dateSchedule(chatContact, arg), gameScreen = screenHome;
    else if (action == 'dateend')
        // gameScreen has to clear screenDateScene before dateFinish() runs,
        // not after - dateFinish() calls calEndWeek() itself, which is where
        // the week actually gets saved, and gameSave()'s own guard refuses to
        // write anything while gameScreen still reads screenDateScene
        gameScreen = screenHome, dateFinish();

    // trips: the weekend with no date in it (GDD 10) - the week's own button
    // lands here (gameEndWeek), a place is set on its first tap, and one of
    // its three offers spends the weekend the same way walking home from a
    // date does
    else if (action == 'triplace')
        tripPlace ||= arg;
    else if (action == 'tripgo')
        dateTripPick(arg), calEndWeek(), gameScreen = screenHome;
    else if (action == 'tripskip')
        calEndWeek(), gameScreen = screenHome;

    // the last day: the letter under the tree (GDD 11)
    else if (action == 'confess')
        endCandidate = characters[arg];
    else if (action == 'letter')
        endWith = endLetter(arg), gameScreen = screenEnding,
            playSound(endWith ? soundGood : soundSad);
    else if (action == 'solo')
        endWith = endCandidate = 0, gameScreen = screenEnding, playSound(soundSad);
    else if (action == 'again')
        gameStart(randInt(1e6)), gameSave();

    // The row at the head of the home screen (dom.js, device.js): it fetches
    // the emoji font, the only thing the game ever reaches for outside its
    // own zip, and it is asked for rather than assumed. The render at the end
    // of this function takes the offer away once it has been taken.
    else if (action == 'font')
        domFontSet(1), gameSwitchSave();

    playSound(soundTap);
    gameRender();
}

///////////////////////////////////////////////////////////////////////////////

// The weekend, and the year's one hard stop: after the last week there is no
// next week, there is a tree and a letter - unless the good ending was never
// earned, in which case the tree is never offered at all (GDD 11)
function gameEndWeek()
{
    if (gameWeek >= calWeeks - 1)
        return gameScreen = endGood() ? screenEnd : screenEnding;

    // a date is what the weekend is spent on, when one is booked - and a
    // trip otherwise, always: skipping ahead with a slot unspent costs the
    // slot, never the Saturday (GDD 10). tripgo and tripskip are what
    // actually roll the week over.
    if (dateContact)
        return dateStart(), gameScreen = screenDateScene;
    gameScreen = screenTrip;
}

///////////////////////////////////////////////////////////////////////////////

function gameRender()
{
    // What the phone is playing (music.js): the everyday piece, unless the
    // screen has something of its own to say. Only a date and an exam do -
    // they are the two places you go rather than pass through, so a change
    // there reads as arriving somewhere rather than as the music twitching at
    // every tap. The title screen is silent, which costs nothing: no browser
    // starts audio before the first tap anyway.
    musicSet(gameScreen == screenTitle ? -1 :
        gameScreen == screenDateScene ? 1 :
        gameScreen == screenActivity && calIsExam() ? 2 : 0);

    // The title is a screen like any other: painted here, so no tap that
    // changes what it says - arming the fresh-year line, taking the font
    // offer - has to remember to repaint it for itself.
    const title = byId('t');
    title.className = gameScreen == screenTitle ? '' : 'hide';
    if (gameScreen == screenTitle)
        title.innerHTML = titleHTML();
    byId('bar').innerHTML = deviceBarHTML();
    byId('hb').innerHTML = deviceHomeBarHTML();

    const modal = byId('m');
    modal.className = gameConfirm ? '' : 'hide';
    modal.innerHTML = gameConfirm ? confirmHTML() : '';

    const screen = byId('s');
    screen.innerHTML = (screenHTML[gameScreen] || homeHTML)();

    // a repainted thread starts at the top, and the newest message is at the
    // bottom, which is the one you just sent and want to see
    const thread = screen.querySelector('.thread');
    if (thread)
        thread.scrollTop = thread.scrollHeight;
}

function titleHTML()
{
    return `<div class=big>🏫</div>
        <h1>EMOJI HIGH SCHOOL</h1>
        ${hint('One school year. Six classmates.')}
        ${hint('You only speak emoji.')}
        <p style="font-size:52px">🌈🦄</p>
        <div class=cast>${cast().map(c => c.avatar(46)).join('')}</div>
        ${hint('Text them, read their reactions, find out what they love.')}
        <p class="h blink" style="font-size:22px;margin-top:20px">${gameContinued ?
            `tap to carry on - ${deviceDate()}` : 'tap to start'}</p>
        ${gameContinued ? `<p class="h fresh">${titleFresh ?
            'the old year will be gone forever - tap here again' :
            'or start a fresh year'}</p>` : ''}`;
}

///////////////////////////////////////////////////////////////////////////////
onload = gameInit;
