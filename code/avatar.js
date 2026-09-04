/*
    Character looks
    - an avatar is one head out of a pool of animal faces, colorized: sepia
      strips whatever colour Twemoji drew it in, then the hue turns it the
      character's own, so a gray wolf and an orange fox come out equally vivid
    - which face, which colour and which name are all dealt per run in
      characters.js, so no two school years have the same cast
    - avatars never emote, feelings arrive as emoji in chat bubbles
*/

'use strict';

// A character's look, everything here is cosmetic and fixed for the run: the
// face, and the filter recipe that colours it. The tilt is in degrees and is
// what gives each character a silhouette of their own.
//
// It hands back the one thing anybody ever wanted from it - draw me at this
// many pixels - so the recipe is built once for the year instead of on every
// render, and a call site reads c.avatar(56) instead of c.avatar.html(56).
// It was a class with five fields and an html() method; nothing outside this
// file ever read a field. The box is an em square (see .av), so one recipe
// sits the same at every size the phone draws it.
function avatar(face, hue, saturate, brightness, tilt)
{
    const look = `filter:sepia(1) saturate(${saturate}) hue-rotate(${hue}deg) ` +
        `brightness(${brightness});transform:rotate(${tilt}deg)`;
    return size => `<span class=av style="font-size:${size}px;${look}">${face}</span>`;
}
