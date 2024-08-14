export function mmss(timecode) {
    const minutes = Math.floor(timecode / 60);
    const seconds = timecode % 60;
    return `${minutes > 9 ? minutes : `0${minutes}`}:${seconds > 9 ? seconds : `0${seconds}`}`;
}