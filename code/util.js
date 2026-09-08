/*
    The handful of helpers the whole game leans on. Everything here is
    either used often enough to earn a short name or too small to sit
    anywhere else.
*/

'use strict';

// These three pay for themselves: Math.min( sits inside expressions the
// minifier cannot shorten either way. Aliasing Object.keys the same way
// costs bytes rather than saving them - it repeats often enough that the
// compressor already has it, and an alias only adds a name.
const min = Math.min, max = Math.max, abs = Math.abs;

const rand = (valueA = 1, valueB = 0) => valueB + Math.random()*(valueA - valueB);
const randInt = (valueA, valueB = 0) => rand(valueA, valueB) | 0;

// clamp, which keeps the calendar's month arrows inside the year
const clamp = (value, low = 0, high = 1) => value < low ? low : value > high ? high : value;
