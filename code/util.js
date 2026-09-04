/*
    The handful of helpers this game used to get from LittleJS
    - the engine cost about 3.3KB of the zip to provide a canvas renderer we
      no longer use, so all that is left of it is this and the sound in audio.js
*/

'use strict';

const min = Math.min, max = Math.max, abs = Math.abs;
// Object.keys is read eight times and was aliased here in the same spirit
// during the size pass - measured, that cost 9 bytes rather than saving any:
// Object.keys( repeats often enough that the compressor already has it, and
// an alias only adds a name. The three above pay because Math.min( sits
// inside expressions the minifier then cannot shorten either way.

const rand = (valueA = 1, valueB = 0) => valueB + Math.random()*(valueA - valueB);
const randInt = (valueA, valueB = 0) => rand(valueA, valueB) | 0;

// clamp, which keeps the calendar's month arrows inside the year
const clamp = (value, low = 0, high = 1) => value < low ? low : value > high ? high : value;
