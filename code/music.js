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
// Designer and it works. There was a lead over this, played twice an octave
// apart, and it went in the size pass: a phone in a school bag does not need
// a tune, and a kick, a hat and a bass are what "chill" is made of.
//
// The second slot is randomness, and playNote holds it at zero so a note is in
// tune. Name it yourself if you want one sound to wobble; .005 is a hint of
// chorus, .05 - ZzFX's own default - is four fifths of a semitone.
let musicKick = [.35,0,80,,,.02,,,,,,,,2];
let musicHat  = [.2,0,1e3,.01,,.01,4,5];
let musicBass = [.2,0,40,,,.05,,.5,,,,,,,,,,.1,.1];

// The harmony, and all of it: one number walks a step either way every four
// bars and comes home every sixteen, and the bass plays whatever root that
// lands on. Two sets of roots, in semitones - the tonic, the fourth and the
// fifth make a major room, the tonic, the minor third and the fifth a darker
// one, which is what an exam gets.
//
// A lead used to play over these, and then the two lists had to be chosen so
// that every root plus every melody note stayed in the key. With the lead gone
// the roots ARE the music, so anything here is in key by definition - but if a
// tune ever comes back, that constraint comes back with it, and test/music.mjs
// is where it is written down.
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
let musicBeat = 0, musicChord = 0;

// the music switch, on its own key beside the one for sound effects (game.js)
let musicEnabled = 1;

// One beat. The whole form is modulo arithmetic on a beat count: the drums
// kick states the pulse, the bass comes in at 32, the hat rests for the last
// quarter of every 128, and the harmony comes home every 256.
function musicTick()
{
    const [, roots, hat] = musicContexts[musicContext];

    // a new chord every four bars, walking a step either way, home every 256
    if (musicBeat%32 == 0)
        musicChord = musicBeat%256 ? musicChord + randSign() : 0;

    // The hat, which is the part a piece can do without: it drops out for the
    // last bar of every four so the loop breathes, and it steps out entirely
    // on a date. The accent every other beat is what gives it its swing.
    if (hat && musicBeat%128 < 96 && (musicBeat%2 == 0 || !randInt(9)))
        playNote(musicHat, 0, ((musicBeat >> 1)%4 == 2 ? .4 : .2) - rand(.1));

    // the kick keeps time whatever else is happening
    if (musicBeat%4 == 0 && musicBeat%128 < 64)
        playNote(musicKick, 0, ((musicBeat >> 1)%4 == 0 ? .5 : 1) - rand(.2));

    // the bass, mostly on the beat and occasionally off it
    if (musicBeat >= 32 &&
        (musicBeat%2 == 0 && (musicBeat%8 == 0 || randInt(4)) || !randInt(9)))
        playNote(musicBass, MUSIC_ROOTS[roots][mod(musicChord, 4)], 1);

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
