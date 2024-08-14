import { mmss } from "./utils/formatTime.js";
import { clamp, getFileFormat, getFileName, compareBlobs } from "./utils/extraFunctions.js";
import { rgbTohsl, colorShadeName } from "./utils/colorFunctions.js";
let jsmediatags = window.jsmediatags;

/*
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │ DOM objects preload                                                        │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
*/ 


// TODO:
// .webm no audio try catch
// Volume >100%
// Anything else...
// Add FULL mobile support

const documentBody = document.getElementById("maindoc");

const loader = document.getElementById("loader");

const fileInput = document.getElementById("file-upload");
const dirInput = document.getElementById("directory-path-upload");
const pillarsWrapper = document.getElementById("pillars-wrapper");

const audioPlayer = document.getElementById("audio-player");
const audioCurrTime = document.getElementById("audio-current-time");
const audioDur = document.getElementById("audio-duration");
const audioProgress = document.getElementById("audio-progress");
const audioPlayBtn = document.getElementById("audio-play-btn");
const playBtnPath = document.getElementById("play-btn-path");
const pauseBtnPath = document.getElementById("pause-btn-path");

const currAudio = document.getElementById("audio-src");

const songHeaderGradientBorder = document.getElementById("song-header-gradient-border");
const songHeaderEmptyImage = document.getElementById("empty-header-image");
const songHeaderImage = document.getElementById("song-header-image");
const songHeaderTitle = document.getElementById("song-header-title");
const songHeaderArtist = document.getElementById("song-header-artist");

const volumeButton = document.getElementById("volume-button");
const volumePathOne = document.getElementById("volume-path-one");
const volumePathTwo = document.getElementById("volume-path-two");
const volumePathThree = document.getElementById("volume-path-three");
const volumePathFour = document.getElementById("volume-path-four");
const volumePathMuted = document.getElementById("volume-path-muted");
const volumeInput = document.getElementById("volume-input");

const songList = document.querySelector("#song-list-frame > .scrollable-content-wrapper > .scrollable-content-list");
const songListWrapper = document.getElementById("song-list-wrapper");

/*
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │ Global variables                                                           │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
*/ 

let tooltips = document.querySelectorAll('.pillar-text');
let pillarsContainers = document.querySelectorAll(".pillar-container");
let pillars = document.querySelectorAll(".pillar");
const pillarsBackground = document.getElementById("pillars-background");

const visualizer = document.getElementById("background-visualizer");

let isProgressBarHeld = false;
let isVolumeBarHeld = false;

let firstTime = true;

const deviceWidth = (window.innerWidth > 0) ? window.innerWidth : screen.width;
const deviceHeight = (window.innerHeight > 0) ? window.innerHeight : screen.height;

window.AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let analyzer = null;
let source = null;
let dataArray = [];
let bufferLength = 0;
let elements = [];
let freqStep = 0;

const blocks = 20;
const maxPillarHeight = 50;
const minPillarHeight = 10;
const pillarWidth = 6;
const pillarGapWidth = 4;

let backgroundBlocks = 64;
// if (deviceWidth < 1200) {
//     backgroundBlocks = 48;
// } else if (deviceWidth < 800) {
//     backgroundBlocks = 32;
// } else if (deviceWidth < 600) {
//     backgroundBlocks = 24;
// }
let canRedraw = false;

const songs = [];
const supportedAudioFormats = ["mp3", "wav", "ogg", "m4a", "flac", "weba"];

let canDoAnything = true;

let currVolume = 100;
let lastSongId = -1;
let lastSongPlaytime = 0;

const scrollingObject = {
    scrolling: false,
    startY: 0,
    scrollTop: songListWrapper.scrollTop
};

const options = {
    changeStyle: true,
    gradientBorder: true,
    defaultStyle: "gray-preset"
};
if (options.gradientBorder) {
    songHeaderGradientBorder.classList.remove("hidden");
}

let context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

/*
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │ Main functions                                                             │
  │                                                                            │
  │ Mandatory for the project to start working                                 │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
*/ 

const askPermission = () => {
    return canDoAnything;
}

const playSong = (songId = -1, ignorePermission = false) => {
    if (songId === -1) {
        process(null, true);
        return;
    }
    const song = songs[songId];
    console.log(song);
    lastSongId = songId;
    updateHeader(song.tags);
    if (options.changeStyle) updatePlayerStyle(song.style);
    display(song.resultArr);
    updateAudio(song.songFile);
    audioDur.textContent = mmss(Math.floor(song.songDuration));
    audioProgress.max = Math.floor(song.songDuration);
    audioProgress.value = 0;
    playAudio(ignorePermission);
}

const process = (file = null, startAfter = true) => {
    return new Promise(async (resolve, reject) => {
        if (!file) {
            if (!fileInput.files) {
                return;
            }
            file = fileInput.files[0];
        }
        for (const song of songs) {
            if (await compareBlobs(song.songFile, file)) {
                if (startAfter) playSong(song.id);
                resolve(true);
                // console.log("Song already exists!");
                return;
            }
        }
        const tags = await getFileTags(file);
        let songStyle = options.defaultStyle;
        if (options.changeStyle) {
            const rgbAvg = await getAveragergb(tags.cover);
            if (rgbAvg) {
                songStyle = `${colorShadeName(rgbTohsl(rgbAvg))}-preset`;
            }
            console.log(songStyle);
        }
        const reader = new FileReader();
        const resultArr = [];
        
        reader.onloadend = () => {
            const arrBuf = reader.result;
            const audioContext = new AudioContext();
            const calcArr = [];
            let maxval = 0;
            let songDuration = 0;
    
            const promise1 = audioContext.decodeAudioData(arrBuf, (buf) => {
                let rawData = buf.getChannelData(0);
                const duration = buf.duration;
                songDuration = duration;
                let proceed = 0;
                const blockSize = Math.floor(rawData.length / blocks);
                for (let i = 0; i < blocks; i++) {
                    let start = blockSize * i;
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(rawData[start + j]);
                    }
                    calcArr.push({
                        sum: sum,
                        timecode: Math.floor(proceed)
                    });
                    maxval = Math.max(maxval, sum);
                    proceed += duration / blocks;
                }
            });
            
            Promise.all([promise1]).then(_values => {
                calcArr.forEach(({ sum, timecode }) => {
                    resultArr.push({
                        coef: sum / maxval,
                        timecode: timecode
                    });
                });
                const newSongId = songs.length;
                const newSong = {
                    id: newSongId,
                    resultArr: resultArr,
                    songFile: file,
                    songDuration: songDuration,
                    tags: tags,
                    style: songStyle
                };
                songs.push(newSong);
                const newSongElement = document.createElement("li");
                const newSongFrame = document.createElement("div");
                newSongFrame.classList.add("song-picker-frame");
                newSongFrame.innerHTML += `
                    <h3 class="song-picker-title">${getFileName(file.name)[0]}</h3>
                    <p class="song-picker-duration">Duration: ${mmss(Math.floor(songDuration))}</p>
                `;
                newSongFrame.addEventListener("click", e => {
                    playSong(newSongId);
                })
                newSongElement.appendChild(newSongFrame);
                songList.appendChild(newSongElement);
                if (startAfter) {
                    lastSongId = newSongId;
                    updateHeader(tags);
                    if (options.changeStyle) updatePlayerStyle(songStyle);
                    display(resultArr);
                    updateAudio(file);
                    audioDur.textContent = mmss(Math.floor(songDuration));
                    audioProgress.max = Math.floor(songDuration);
                    audioProgress.value = 0;
                    currAudio.load();
                    playBtnPath.classList.remove("hidden");
                    pauseBtnPath.classList.add("hidden");
                }
                resolve(true);
            });
        }

        reader.onerror = () => {
            reject(true);
        }
    
        reader.readAsArrayBuffer(file);
    });
}

const processMultiple = () => {
    return new Promise(async (resolve, reject) => {
        if (lastSongId !== -1) {
            lastSongPlaytime = currAudio.currentTime;
            pauseAudio(true);
        }
        const files = dirInput.files;
        dirInput.files = new DataTransfer().files;
        const promises = [];
        for (const file of files) {
            let fileFormat = getFileFormat(file.name);
            if (!fileFormat) continue;
            fileFormat = fileFormat[0];
            if (supportedAudioFormats.some(format => format === fileFormat)) {
                promises.push(process(file, false));
            }
        }
        Promise.all(promises).then(() => {
            let ignorePermission = true;
            if (songs.length > 0) {
                if (lastSongId === -1) {
                    ignorePermission = false;
                    lastSongId = 0;
                }
                playSong(lastSongId, ignorePermission);
                currAudio.currentTime = lastSongPlaytime;
            }
            resolve(true);
        });
    });
}

const getFileTags = async (file) => {
    return new Promise((resolve, reject) => {
        new jsmediatags.read(file, {
            onSuccess: (tag) => {
                resolve(tag);
            },
            onError: (error) => {
                console.log("Error: ", error);
                resolve(null);
            }
        });
    }).then(val => {
        const result = {
            title: getFileName(file.name)[0],
            artist: "Unknown",
            album: "Unknown",
            cover: null
        }
        if (val) {
            val = val.tags;
            if (val.title) {
                result.title = val.title;
            }
            if (val.artist) {
                result.artist = val.artist;
            }
            if (val.album) {
                result.album = val.album;
            }
            if (val.picture) {
                const coverArr = val.picture;
                let base64String = "";
                const { data, format } = coverArr;
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                result.cover = `data:${data.format};base64,${window.btoa(base64String)}`;
            }
        }
        console.log(result);
        return result;
    });
}

const display = (arr) => {
    if (pillars.length === 0) {
        for (let i = 0; i < blocks; i++) {
            const newBarContainer = document.createElement("div");
            newBarContainer.classList.add("pillar-container");
            const newBar = document.createElement("div");
            newBar.classList.add("pillar");
            newBar.style.width = "100%";
            newBar.style.height = minPillarHeight + "px";
            // newBarContainer.addEventListener("click", () => {
            //     changeAudioTime(timecode);
            // })
            // newBarContainer.addEventListener("mousemove", (e) => {
            //     const tooltip = newBarContainer.querySelector(".pillar-text");
            //     tooltip.style.top = (e.clientY - tooltip.offsetHeight * 1.32) + "px";
            //     tooltip.style.left = (e.clientX - tooltip.offsetWidth / 2) + "px";
            //     newBarContainer.style.zIndex = 2;
            // });
            // newBarContainer.addEventListener("mouseleave", (e) => {
            //     const tooltip = newBarContainer.querySelector(".pillar-text");
            //     tooltip.style.top = "0%";
            //     tooltip.style.left = "0%";
            //     newBarContainer.style.zIndex = 1;
            // })
            // const barTooltip = document.createElement("span");
            // barTooltip.classList.add("pillar-text");
            // barTooltip.textContent = mmss(timecode);
            // newBarContainer.appendChild(barTooltip);
            newBarContainer.appendChild(newBar);
            pillarsWrapper.appendChild(newBarContainer);
        }
        tooltips = document.querySelectorAll('.pillar-text');
        pillarsContainers = document.querySelectorAll(".pillar-container");
        pillars = document.querySelectorAll(".pillar");
        return;
    }
    pillars.forEach((pillar, index) => {
        pillar.style.width = "100%";
        pillar.style.height = Math.max(Math.ceil(maxPillarHeight * arr[index].coef), minPillarHeight) + "px";
    });
    if (!canRedraw) {
        canRedraw = true;
    }
}

const changeAudioTime = (newTime) => {
    currAudio.currentTime = newTime;
    if (currAudio.paused) {
        currAudio.play();
        playBtnPath.classList.toggle("hidden");
        pauseBtnPath.classList.toggle("hidden");
    }
}

const updateAudio = (file = null) => {
    if (!file) {
        alert("Input an audio file!");
        return;
    }

    const fileUrl = URL.createObjectURL(file);
    
    currAudio.src = fileUrl;
}

const redrawProgressBar = () => {
    requestAnimationFrame(redrawProgressBar);
    if (isVolumeBarHeld) {
        updateVolume(volumeInput.value);
    }
    if (!canRedraw || !askPermission()) return;
    if (!isProgressBarHeld) audioProgress.value = currAudio.currentTime.toFixed(4);
    audioCurrTime.textContent = mmss(Math.floor(currAudio.currentTime));
    const indexFrom = audioProgress.value / currAudio.duration * blocks;
    const maxIndex = Math.floor(indexFrom);
    const percent = ((indexFrom - maxIndex) * 100).toFixed(4);
    let index = 0;
    for (const pillar of pillars) {
        if (index < maxIndex) {
            pillar.style.width = "100%";
        } else if (index === maxIndex) {
            pillar.style.width = percent + "%";
        } else {
            pillar.style.width = "0%";
        }
        index++;
    }
    analyzer.getByteFrequencyData(dataArray);
    // dataArray.forEach((val, ind) => val + weightingdB(binToFreq(ind)));
    let j = 0;
    for (let i = 0; i < backgroundBlocks; i++) {
        let res = 0;
        while (binToFreq(j) < elements[i].freqMax && j < bufferLength) {
            // res = Math.max(res, normalizedB(dataArray[j]));
            res = Math.max(res, dataArray[j]);
            j++;
        }
        elements[i].element.style.height = deviceHeight * res / 255 + "px";
        // elements[i].element.style.backgroundColor = `rgb(${res}, 100, 255)`;
    }
    // for (let i = 0; i < bufferLength; i++) {
    //     let freq = dataArray[i] + weightingdB(2 ** (4 + i/6.3));
    //     // console.log(mWeight(freqStep * (i + 1)), freq, dataArray[i], normalizedB(freq));
    //     freq = normalizedB(freq);
    //     elements[i].element.style.height = deviceHeight * freq + "px";
    //     elements[i].element.style.backgroundColor = `rgb(${freq * 255}, 100, 255)`;
    //     // elements[i].style.height = clamp(item / 255 * deviceHeight + 10, 10, deviceHeight * 0.95) + "px";
    // }
}
requestAnimationFrame(redrawProgressBar);

const toggleAudio = () => {
    if (!source) {
        alert("Input an audio file!");
        return;
    }
    if (currAudio.paused) {
        playAudio();
    } else {
        pauseAudio();
    }
}

const playAudio = (ignorePermission = false) => {
    if (!ignorePermission && !askPermission()) return;
    currAudio.play();
    playBtnPath.classList.add("hidden");
    pauseBtnPath.classList.remove("hidden");
}

const pauseAudio = (ignorePermission = false) => {
    if (!ignorePermission && !askPermission()) return;
    currAudio.pause();
    playBtnPath.classList.remove("hidden");
    pauseBtnPath.classList.add("hidden");
}

const playPreviousSong = () => {
    if (lastSongId === -1) return;
    if (lastSongId === 0) {
        playSong(songs.length - 1);
        return;
    }
    playSong(lastSongId - 1);
}

const playNextSong = () => {
    if (lastSongId === -1) return;
    if (lastSongId === songs.length - 1) {
        playSong(0);
        return;
    }
    playSong(lastSongId + 1);
}

const updateVolume = (newVolume) => {
    if (newVolume === currVolume) return;
    currVolume = newVolume;
    currAudio.volume = newVolume / 100;
    renderVolumeButton(newVolume);
    //
    //           Preset for the >100% volume (TODO)
    //
    // var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // var source = audioCtx.createMediaElementSource(myVideoElement);

    // // create a gain node
    // var gainNode = audioCtx.createGain();
    // gainNode.gain.value = 2; // double the volume
    // source.connect(gainNode);

    // // connect the gain node to an output destination
    // gainNode.connect(audioCtx.destination);
}

const renderVolumeButton = (volume) => {
    if (volume >= 75) {
        volumePathOne.classList.remove("hidden");
        volumePathTwo.classList.add("hidden");
        volumePathThree.classList.add("hidden");
        volumePathFour.classList.add("hidden");
        volumePathMuted.classList.add("hidden");
    } else if (volume >= 50) {
        volumePathOne.classList.add("hidden");
        volumePathTwo.classList.remove("hidden");
        volumePathThree.classList.add("hidden");
        volumePathFour.classList.add("hidden");
        volumePathMuted.classList.add("hidden");
    } else if (volume >= 25) {
        volumePathOne.classList.add("hidden");
        volumePathTwo.classList.add("hidden");
        volumePathThree.classList.remove("hidden");
        volumePathFour.classList.add("hidden");
        volumePathMuted.classList.add("hidden");
    } else if (volume >= 1) {
        volumePathOne.classList.add("hidden");
        volumePathTwo.classList.add("hidden");
        volumePathThree.classList.add("hidden");
        volumePathFour.classList.remove("hidden");
        volumePathMuted.classList.add("hidden");
    } else {
        volumePathOne.classList.add("hidden");
        volumePathTwo.classList.add("hidden");
        volumePathThree.classList.add("hidden");
        volumePathFour.classList.add("hidden");
        volumePathMuted.classList.remove("hidden");
    }
}

async function getAveragergb(src) {
    return new Promise((resolve, reject) => {
        if (!src) {
            resolve(null);
            return;
        }
        context.imageSmoothingEnabled = true;

        let img = new Image;
        img.src = src;
        img.crossOrigin = "";

        img.onload = () => {
            context.drawImage(img, 0, 0, 1, 1);
            const rgbArr = context.getImageData(0, 0, 1, 1).data.slice(0,3);
            resolve({ r: rgbArr[0], g: rgbArr[1], b: rgbArr[2] });
        };
    }).then(values => {
        console.log(values);
        return values;
    });
}

const updateHeader = (tags) => {
    let srcString = "";
    if (tags.cover) {
        songHeaderEmptyImage.classList.add("hidden");
        songHeaderImage.classList.remove("hidden");
        songHeaderImage.src = tags.cover;
        srcString = tags.cover;
    } else {
        songHeaderEmptyImage.classList.remove("hidden");
        songHeaderImage.classList.add("hidden");
    }
    songHeaderTitle.textContent = tags.title;
    songHeaderArtist.textContent = tags.artist;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: tags.title,
        artist: tags.artist,
        album: tags.album,
        artwork: [
            { src: srcString } //, sizes: "32x32", type: "image/png" }
        ]
        // artwork: [
        //     { src: 'https://mytechnicalarticle/kendrick-lamar/to-pimp-a-butterfly/alright/96x96', sizes: '96x96', type: 'image/png' },
        //     { src: 'https://mytechnicalarticle/kendrick-lamar/to-pimp-a-butterfly/alright/128x128', sizes: '128x128', type: 'image/png' },
        //     // More sizes, like 192x192, 256x256, 384x384, and 512x512
        // ]
    });
}

const updatePlayerStyle = (style) => {
    documentBody.className = "";
    documentBody.classList.add(style);
}

const setup = () => {
    if (firstTime) {
        firstTime = false;
        audioCtx = new window.AudioContext();
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 8192;
        analyzer.smoothingTimeConstant = 0.3;
        bufferLength = analyzer.frequencyBinCount;
        freqStep = audioCtx.sampleRate / analyzer.fftSize;

        dataArray = new Uint8Array(bufferLength);
        for(let i = 0; i < backgroundBlocks; i++) {
            const element = document.createElement('div');
            element.classList.add('visualizer-pillar');
            const elementObject = {
                element: element,
                freqMin: binToFreq(i),
                freqMax: binToFreq(i + 1)
            };
            elements.push(elementObject);
            visualizer.appendChild(element);
            element.style.height = "0px";
        }
        
        currAudio.loop = true;
        source = audioCtx.createMediaElementSource(currAudio);
        source.connect(analyzer);
        source.connect(audioCtx.destination);
    }
}
display([]);

/*
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │ Event listeners                                                            │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
*/ 

window.addEventListener("click", e => {
    console.log(e.target);
});
window.addEventListener('keydown', e => { if (e.key === "Enter") debugger })

// document.getElementById("pillars-wrapper").onmousemove = function (e) {
//     tooltips.forEach(tooltip => {
//         tooltip.style.top = (e.clientY - tooltip.offsetHeight * 1.3) + "px";
//         tooltip.style.left = (e.clientX - tooltip.offsetWidth / 2) + "px";
//     })
// };

fileInput.addEventListener("input", e => {
    setup();
    playSong();
});
dirInput.addEventListener("input", e => {
    setup();
    loader.classList.remove("hidden");
    canDoAnything = false;
    const promise1 = processMultiple();
    Promise.all([promise1]).then(() => {
        canDoAnything = true;
        loader.classList.add("hidden");
    });
});

audioPlayBtn.addEventListener("click", toggleAudio);

audioProgress.addEventListener('mouseup', () => {
    if (source) currAudio.currentTime = audioProgress.value;
    isProgressBarHeld = false;
});
audioProgress.addEventListener('mousedown', () => {
    isProgressBarHeld = true;
});

volumeButton.addEventListener("click", () => {
    volumeInput.classList.toggle("hidden");
})

volumeInput.addEventListener("mousedown", () => {
    isVolumeBarHeld = true;
});
volumeInput.addEventListener("mouseup", () => {
    isVolumeBarHeld = false;
});

songListWrapper.addEventListener("mousedown", (e) => mouseIsDown(e));
songListWrapper.addEventListener("mouseup", (e) => mouseUp(e));
songListWrapper.addEventListener("mouseleave", (e) => mouseLeave(e));
songListWrapper.addEventListener("mousemove", (e) => mouseMove(e));

function mouseIsDown(e) {
    scrollingObject.scrolling = true;
    scrollingObject.startY = e.pageY - songListWrapper.offsetTop;
    scrollingObject.scrollTop = songListWrapper.scrollTop;
}
function mouseUp(e) {
    scrollingObject.scrolling = false;
}
function mouseLeave(e) {
    scrollingObject.scrolling = false;
}
function mouseMove(e) {
    if (scrollingObject.scrolling) {
        e.preventDefault();
        //Move vertcally
        const y = e.pageY - songListWrapper.offsetTop;
        const walkY = (y - scrollingObject.startY) * 5;
        songListWrapper.scrollTop = scrollingObject.scrollTop - walkY;
    }
}

if ('mediaSession' in navigator) {
    const updatePositionState = () => {
        navigator.mediaSession.setPositionState({
            duration: currAudio.duration,
            playbackRate: currAudio.playbackRate,
            position: currAudio.currentTime
        });
    }
       
    const actionsAndHandlers = [
        ['play', () => {
            console.log("Tried to play...");
            console.log(currAudio.src, currAudio.paused);
            playAudio();
            updatePositionState();
        }],
        ['pause', () => { 
            console.log("Tried to pause...");
            console.log(currAudio.src, currAudio.paused);
            pauseAudio();
        }],
        ['previoustrack', () => { playPreviousSong(); }],
        ['nexttrack', () => { playNextSong(); }],
        ['seekbackward', (details) => {
            if (!askPermission()) return;
            currAudio.currentTime = currAudio.currentTime - (details.seekOffset || 10);
            updatePositionState();
        }],
        ['seekforward', (details) => {
            if (!askPermission()) return;
            currAudio.currentTime = currAudio.currentTime + (details.seekOffset || 10);
            updatePositionState();
        }],
        ['seekto', (details) => {
            // if (details.fastSeek && 'fastSeek' in alright) {
            //     alright.fastSeek(details.seekTime);
            //     updatePositionState();
            //     return;
            // }
            // alright.currentTime = details.seekTime;
            // updatePositionState();
            return;
        }],
        ['stop', () => {
            pauseAudio();
            currAudio.currentTime = 0;
        }],
    ]
    
    for (const [action, handler] of actionsAndHandlers) {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
            console.log(`The media session action, ${action}, is not supported`);
        }
    }
}














function weightingdB(freq) {
    const f2 = freq ** 2;
    const h1 = -4.737338981378384e-24 * freq ** 6 + 2.043828333606125e-15 * freq ** 4 - 1.363894795463638e-7 * f2 + 1;
    const h2 = 1.306612257412824e-19 * freq ** 5 - 2.118150887518656e-11 * freq ** 3 + 5.559488023498642e-4 * freq;
    const rI = 1.246332637532143e-4 * freq / Math.hypot( h1, h2 );
    const linearTodB = value => 20 * Math.log10( value );
    return 18.2 + linearTodB( rI );
}

function binToFreq(bin) {
    return bin * audioCtx.sampleRate / analyzer.fftSize || 1; // returns 1 for bin 0
}

function normalizedB( value ) {
    let maxValue = analyzer.maxDecibels;
    let minValue = analyzer.minDecibels;
    return clamp( ( value - minValue ) / ( maxValue - minValue ), 0, 1 );
}

// let blocks = 40;
// if (deviceWidth >= 1200) {
//     blocks = 40;
// } else if (deviceWidth >= 1100) {
//     blocks = 35;
// } else if (deviceWidth >= 1000) {
//     blocks = 32;
// } else if (deviceWidth >= 900) {
//     blocks = 30;
// } else if (deviceWidth >= 750) {
//     blocks = 25;
// } else if (deviceWidth >= 600) {
//     blocks = 20;
// } else {
//     blocks = 15;
// }
