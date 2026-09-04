/*
    Sound - ZzFX (MIT, Frank Force), cut down to what this game's seven sounds
    actually ask for
    - the parameter list below is still ZzFX's, in ZzFX's order and in ZzFX's
      positions, so a sound built in the Sound Designer still pastes straight
      in and still plays. That was the whole reason a nine-parameter version
      was abandoned once the music arrived: tuning an instrument is not a
      thing to do by conversion table (tools/music.html)
    - what is gone is the machinery behind seven of those parameters, not the
      parameters. sustain, deltaSlide, repeatTime, modulation, bitCrush,
      delay and tremolo are named here and read nowhere: no sound in the game
      sets one, so a paste that uses one still pastes and still plays, and
      that one effect simply does not happen. Exactly what the biquad filter
      has always done - it was the twenty-first parameter and went the same
      way, being most of a hundred bytes of nothing this game does.
    - two shapes went with them. The game plays 0 sine, 1 triangle, 2 saw and
      4 noise; 3 tan and 5 square were never asked for, so the ladder stops
      at noise and anything above 2 lands on it. Losing square also loses the
      one branch that skipped the shape curve, which was the point.
    - the sounds were proved unchanged by rendering all seven through both
      synths, sample for sample, before any of it came out.
*/

'use strict';

let audioContext;

// the sound switch, which lives in the phone's status bar where a phone
// keeps it - and on its own key, apart from the week save (game.js,
// gameSwitchSave)
let audioEnabled = 1;

const audioSampleRate = 44100;

/*
    volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
    slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
    bitCrush, delay, sustainVolume, decay, tremolo

    shape: 0 sine, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square
*/
function zzfx(volume = 1, randomness = .05, frequency = 220, attack = 0,
    sustain, release = .1, shape = 0, shapeCurve = 1, slide = 0,
    deltaSlide, pitchJump = 0, pitchJumpTime = 0, repeatTime,
    noise = 0, modulation, bitCrush, delay, sustainVolume = 1, decay = 0)
{
    const PI2 = Math.PI*2, sampleRate = audioSampleRate;
    let b = [], t = 0, i = 0, j = 1, s = 0, f, length;

    slide *= 500 * PI2 / sampleRate / sampleRate;
    frequency *= rand(1 + randomness, 1 - randomness) * PI2 / sampleRate;

    // scale by sample rate. The nine sample floor on attack is what stops a
    // sound with no attack at all popping as it starts.
    attack = attack * sampleRate || 9;
    decay *= sampleRate;
    release *= sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;

    for (length = attack + decay + release | 0; i < length; b[i++] = s * volume)
    {
        s = shape ? shape > 1 ? shape > 2 ?
            Math.sin(t**3) :                            // 4 noise
            1 - (2*t/PI2%2 + 2)%2 :                     // 2 saw
            1 - 4*abs(Math.round(t/PI2) - t/PI2) :      // 1 triangle
            Math.sin(t);                                // 0 sine

        s = Math.sign(s)*abs(s)**shapeCurve *           // shape curve
            (i < attack ? i/attack :                    // attack
            i < attack + decay ?                        // decay
            1 - ((i - attack)/decay)*(1 - sustainVolume) :
            (length - i)/release * sustainVolume);      // release

        f = frequency += slide;                         // frequency
        t += f + f*noise*Math.sin(i**5);                // noise

        if (j && ++j > pitchJumpTime)                   // pitch jump
            frequency += pitchJump, j = 0;
    }

    // hand the samples to the audio hardware
    audioContext = audioContext || new AudioContext;
    if (audioContext.state != 'running')
        audioContext.resume();
    const buffer = audioContext.createBuffer(1, b.length, sampleRate);
    buffer.getChannelData(0).set(b);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
}

// The game's sounds, in ZzFX's order. The volumes read .18 and .15 rather than
// ZzFX's 1 because the master gain node they used to run through - one more
// node per sound, doing nothing but multiplying by .3 - is folded into them.
const soundTap  = [.4,,440,,,.04,,4,9];
const soundGood = [.2,,440,,,.4,1,3,,,220,.05];
const soundBad  = [.2,,160,,,.4,2,,,,-90,.05];
const soundSad  = [.3,,,,,.4,1,2,-4];

function playSound(sound) { if (audioEnabled) zzfx(...sound); }

// The same sound at a pitch: semitones up or down from its own frequency, with
// a volume scale on top. Deliberately not through playSound - that switch is
// the one on sound effects, and the music has its own.
//
// Randomness goes to zero unless the sound asked for some: ZzFX detunes every
// sound by 5% so a repeated effect does not sound mechanical, and 5% of a
// frequency is four fifths of a semitone - the life in a tapped sound and a
// bass line playing out of tune. tools/music.html is where notes are tuned.
function playNote(sound, semitones, volume)
{
    const note = [...sound];
    note[0] *= volume;
    note[2] *= 2**(semitones/12);
    zzfx(...note);
}
