/*
    The phone, as DOM
    - every screen is an HTML string rendered into one element, and the game
      only re-renders when something changes: no frame loop at all
    - one click listener on the phone handles everything, dispatching on the
      data-a (action) and data-i (argument) of whatever was tapped
    - the phone is authored at a fixed 540x960 and scaled to fit the window,
      so layout is written once and CSS does the rest
*/

'use strict';

let domPhone;

const byId = id => document.getElementById(id);

///////////////////////////////////////////////////////////////////////////////

function domInit()
{
    // The whole of the game's markup, written at boot rather than shipped as
    // html: the shell stays `<script>` alone, so roadroller models these
    // bytes with the rest of the code instead of leaving them to deflate on
    // their own. The one source of truth - index.html and the test harness
    // both boot through here. #m carries no class: gameRender sets its
    // className before anything is ever painted.
    document.body.innerHTML = '<div id=p><div id=bar></div><div id=s></div>' +
        '<div id=hb></div><div id=m></div><div id=t></div></div>';

    domPhone = byId('p');

    onresize = domResize;
    domResize();

    // One listener for the whole game.
    // The dataset keys are quoted on purpose: they are read back out of html
    // the game wrote as a string, and Closure ADVANCED happily renames an
    // unquoted one, which silently breaks every tap that carries an argument
    // in the built game only.
    domPhone.onclick = e =>
    {
        const target = e.target.closest('[data-a]');
        if (!target)
            return;
        gameAction(target.dataset['a'], target.dataset['i']);
    };
}

function domResize()
{
    const scale = min(innerWidth/540, innerHeight/960);
    domPhone.style.transform = `translate(-50%,-50%) scale(${scale})`;
}

///////////////////////////////////////////////////////////////////////////////
// Building HTML

// a tappable thing: action, argument, class, content
function tap(action, arg, className, content)
{
    return `<div class="${className}" data-a="${action}" data-i="${arg}">${content}</div>`;
}

// a labelled button
function button(action, arg, label, className = '')
{
    return tap(action, arg, 'btn ' + className, label);
}

function hint(text) { return `<p class=h>${text}</p>`; }

/*
    What to draw instead, while Twemoji is not loaded.

    Both of these were standardised in 2019 or later and Windows 10's Segoe UI
    Emoji stops before them, so without a stand-in they are drawn as nothing at
    all - and these are the two places on the phone where a missing glyph reads
    as information rather than as a gap. 🤍 is the empty half of the affection
    meter on every contact row, so four blanks say "no idea how they feel"
    instead of "not much"; 🪫 is the week's battery, so a spent week looks
    like a phone with no battery in it. ♡ is a text symbol from Unicode 1.1 and
    is on every machine ever made; an outline heart beside a filled one is what
    the meter means anyway. 🔌 is what the battery was before 🪫.

    Only glyphs the game itself types belong here. Library emoji are NOT
    swapped even though four of them are as new (GDD 2): an emoji's character
    IS its identity there - it keys the keyboard, the reactions, the save and
    every data-i the player taps - so a swap would have to reach a dozen render
    sites and be undone again on the way back in, and one that reached the exam
    card but not the keyboard would be worse than the blank it fixed.

    Quoted keys and a runtime lookup, the hazard CLAUDE.md names: Closure
    ADVANCED renames an unquoted property.
*/
const domSwaps = {'🤍': '♡', '🪫': '🔌'};

// one emoji, as it can actually be drawn
const domSafe = emoji => domFontOn ? emoji : domSwaps[emoji] || emoji;

// one emoji at a size, in the emoji font. Not called emoji() because half the
// map callbacks in the game already have a local named that.
function glyph(what, size)
{
    return `<span style="font-size:${size}px">${domSafe(what)}</span>`;
}

// something with a picture, a heading and a line about it - the shape every
// screen reaches for when it has one thing to say
function card(picture, title, text)
{
    return `<div class=card>${picture}<div class=t><h2>${title}</h2>` +
        `<p class="h l">${text}</p></div></div>`;
}

// The inside of a contact row: their picture, the text block, and the column
// on the right. The row itself is a tap() or a plain div, depending. A row
// with nothing to say on the right gets no column at all rather than an empty
// one - an empty flex item still takes the row's gap with it (Notes).
function rowBody(picture, text, foot)
{
    return `${picture}<div class=t>${text}</div>` +
        (foot ? `<div class=f>${foot}</div>` : '');
}

// one line of a text block: an emoji, in the emoji font, then words - and a
// class for the one line that is drawn bigger than the rest (the mood line)
function iconLine(icon, words, cls = '')
{
    return `<p class="h l ${cls}"><span>${icon}</span> ${words}</p>`;
}

///////////////////////////////////////////////////////////////////////////////
// The emoji font

/*
    Twemoji is not loaded at boot, and that is a rule rather than a taste:
    js13k wants the zip to be the whole entry, so nothing outside it is
    fetched unless the player asks for it. The row at the head of the home
    screen's cards is the asking (device.js, homeHTML) - in the game rather
    than on the title, which is one tap from gone - and the answer sits on its
    own tiny key beside the sound switches (game.js, gameSwitchLoad), so the
    offer stands every week until it is taken and never comes back after.

    Until it is asked, every glyph is drawn by whatever emoji font the device
    already has - which is the state every screen is built to survive. What
    changes is the art style, and on a platform without the newest glyphs, a
    handful of blanks; nothing the game does depends on the font being there.

    The unicode-range keeps Twemoji to the emoji blocks: it holds the digits
    too, and without the range every number on the phone would be drawn in it.
    debug.js puts the local copy (npm run font) in front of the hosted one for
    dev; the shipped game only ever names the hosted url, and only after a tap.
*/
let domFontOn = 0;
let domFontCSS = '<style>@font-face{font-family:emoji;src:url(https://killedbyapixel.github.io/Twemoji.ttf);unicode-range:U+2190-2BFF,U+FE0F,U+200D,U+1F000-1FAFF}</style>';

/*
    insertAdjacentHTML rather than innerHTML +=, which was 18 bytes cheaper
    and wrong. += reads the head, throws every child away and parses them all
    back: for one frame the stylesheet holding the phone together is not in
    the document, and the whole screen flashes white on the tap that was
    supposed to make it prettier. Appending leaves what is already there
    alone, which is the entire point of it.

    The url names https rather than inheriting the page's scheme. A font is
    always fetched in CORS mode, and a protocol-relative url on a page served
    over http lands on the 301 to https - a redirect that carries no
    Access-Control-Allow-Origin of its own, so the fetch fails the check
    before it ever reaches the file. That is every dev server, and file://,
    where it resolves nowhere at all. Six bytes; they buy the font working
    everywhere the game is opened rather than only where it is judged.
*/
function domFontSet(on)
{
    if (domFontOn = on)
        document.head.insertAdjacentHTML('beforeend', domFontCSS);
}
