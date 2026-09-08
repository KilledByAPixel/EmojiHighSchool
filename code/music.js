/*
    The music (GDD 14) - a kick, a hat and a bass, and that is the whole band
    - there is no note data at all: every pattern is a modulo of a beat count,
      and the harmony is one number that walks a step every four bars
    - the piece never stops and never restarts. Walking into a date or an exam
      changes what it is doing without interrupting it, so the year has one
      long piece of music in it that keeps turning over rather than a playlist
    - tuned by ear on tools/music.html, which includes this very file, so the
      bench and the phone play the same music from the same source
    - it draws on rand/randInt (util.js) and NEVER on netRandInt: that is the
      seed's own stream, and a note taken from it would change which opinions
      a year rolls. Music is the one thing here allowed to be truly random.
*/

'use strict';

const mod = (a, b) => (a%b + b)%b;
const randSign = () => randInt(2)*2 - 1;

// The three instruments, as full ZzFX parameter arrays - paste from the Sound
// Designer and it works. A kick, a hat and a bass are the whole band on
// purpose: a phone in a school bag does not need a tune over the top.
//
// The second slot is randomness, and playNote holds it at zero so a note is in
// tune. Name it yourself if you want one sound to wobble; .005 is a hint of
// chorus, .05 - ZzFX's own default - is four fifths of a semitone.
let musicKick = [.35,0,80,.01,,.02,,,,,,,,2];
let musicHat  = [.15,0,220,.01,,.01,4,5];
let musicBass = [.2,0,30,,,,,.5,,,,,,,,,,.1,.1];

// The harmony, and all of it: one number walks a step either way every four
// bars and comes home every sixteen, and the bass plays whatever root that
// lands on. Two sets of roots, in semitones - the tonic, the fourth and the
// fifth make a major room, the tonic, the minor third and the fifth a darker
// one, which is what an exam gets.
//
// With no lead over them the roots ARE the music, so anything here is in key
// by definition. Put a melody back and the two lists have to be chosen so
// every root plus every melody note stays in the key - test/music.mjs is
// where that constraint is written down.
const MUSIC_ROOTS =
[
    [0, 5, 7, 5],   // 0 major - the everyday piece, and a date
    [0, 3, 7, 3],   // 1 minor - the exam
];

// The three pieces. The columns are
//
//   beat ms, roots, hat
//
// There were six of these with thirteen columns each once, one per season plus
// these two. Measured, the tables were never what cost anything - musicTick
// was - so every simplification that mattered was to the tick.
const musicContexts =
[
    [140, 0, 1],   // 0 the everyday piece
    [175, 0, 0],   // 1 a date - slower, and the hat steps out
    [120, 1, 1],   // 2 an exam - faster, and the darker roots
];

// which piece is playing, and where the piece has got to
let musicContext = -1, musicTimer = 0;
let musicBeat = 0, musicChord = 0, bassNote = 0;

// the music switch, on its own key beside the one for sound effects (game.js)
let musicEnabled = 1;

// One beat. The whole form is modulo arithmetic on a beat count, and it takes
// 512 beats - over a minute - to come round: the bass opens alone at 32, the
// kick joins at 128, the hat rests for the last 32 of every 256, and the
// harmony comes home every 256. Nothing here is a bar count in disguise; the
// parts enter and leave on their own modulos, which is why the loop does not
// announce itself to somebody with the phone in a bag.
function musicTick()
{
    // pause music if focus lost
    if (!document.hasFocus())
        return;

    const [, roots, hat] = musicContexts[musicContext];

    // a new chord every four bars, walking a step either way, home every 256
    if (musicBeat%32 == 0)
        musicChord = bassNote = musicBeat%256 ? musicChord + randSign() : 0;

    // The hat, which is the part a piece can do without: it drops out for the
    // last eight bars of every sixty-four so the loop breathes, and it steps
    // out entirely on a date. The accent every other beat is its swing.
    if (hat && musicBeat%256 < 224 && (musicBeat%2 == 0 || !randInt(9)))
        playNote(musicHat, 0, ((musicBeat >> 1)%4 == 2 ? .4 : .2) - rand(.2));

    // The kick keeps time once it is in, and it is not in at the top: it sits
    // out the first quarter of every 512 so the bass has the room to open,
    // and rests the last quarter of every 128 inside that.
    if (musicBeat%512 >= 128 && musicBeat%4 == 0 && musicBeat%128 < 96)
        playNote(musicKick, 0, ((musicBeat >> 1)%4 == 0 ? .5 : 1) - rand(.2));

    // The bass, mostly on the beat and occasionally off it - and the only
    // part playing until the kick arrives. bassNote walks up from the chord
    // root a step at a time, so a held harmony still moves underneath.
    if (musicBeat%512 >= 32 &&
        (musicBeat%8 == 0 || !randInt(9) || musicBeat%256 < 196 && musicBeat%2 == 0 && randInt(4)))
        playNote(musicBass, MUSIC_ROOTS[roots][mod(bassNote += randInt(2), 4)], 1);

    ++musicBeat;
}

// The beat, as a plain interval. Not a frame loop and not scheduled against
// the audio clock: the game does nothing at all between taps, so the main
// thread is idle and a timer holds steady - and the phone keeps its promise
// that no screen redraws unless something changed.
function musicPlay()
{
    clearInterval(musicTimer);
    if (musicEnabled && musicContext >= 0)
        musicTimer = setInterval(musicTick, musicContexts[musicContext][0]);
}

// What the phone is playing, as a row of musicContexts - or -1 for silence,
// which is the title screen.
//
// Nothing is reset here on purpose. The beat count and the chord carry across,
// so walking into a date does not start a new song over the top of the old
// one - the piece already playing changes its tempo, its roots and whether the
// drums are in, and carries on. Only the timer is replaced, because the tempo
// it was running at is the one thing an interval cannot change on its own.
function musicSet(context)
{
    if (context == musicContext)
        return;
    musicContext = context;
    musicPlay();
}
