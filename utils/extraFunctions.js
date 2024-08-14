export function clamp(num, min, max) {
    if(num >= max) return max;
    if(num <= min) return min;
    return num;
}

export function getFileFormat(filename) {
    return (/[.]/.exec(filename)) ? /[^.]+$/.exec(filename) : undefined;
}

export function getFileName(filename) {
    return (/[.]/.exec(filename)) ? /^[^.]*/.exec(filename) : filename;
}

export async function compareBlobs(blob1, blob2) {
    const arrayBufferFileA = await blob1.arrayBuffer();
    const arrayBufferFileB = await blob2.arrayBuffer();

    if ( arrayBufferFileA.byteLength !== arrayBufferFileB.byteLength ) {
        return false;
    }

    const uint8ArrayA = new Uint8Array(arrayBufferFileA);
    const uint8ArrayB = new Uint8Array(arrayBufferFileB);

    let filesAreTheSame = true;

    for (let i = 0, len = uint8ArrayA.length; i < len; i++) {
        if ( uint8ArrayA[i] !== uint8ArrayB[i] ){
            filesAreTheSame = false;
            break;
        }
    }

    return filesAreTheSame;
}