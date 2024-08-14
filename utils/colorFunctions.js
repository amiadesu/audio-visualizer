export function rgbTohsl(rgb) {
    var r1 = rgb.r / 255, g1 = rgb.g / 255, b1 = rgb.b / 255;
    var maxColor = Math.max(r1,g1,b1), minColor = Math.min(r1,g1,b1);
    var L = (maxColor + minColor) / 2 , S = 0, H = 0;
    if (maxColor != minColor) {
        if (L < 0.5) {
            S = (maxColor - minColor) / (maxColor + minColor);
        } else {
            S = (maxColor - minColor) / (2.0 - maxColor - minColor);
        }
        if (r1 == maxColor) {
            H = (g1-b1) / (maxColor - minColor);
        } else if (g1 == maxColor) {
            H = 2.0 + (b1 - r1) / (maxColor - minColor);
        } else {
            H = 4.0 + (r1 - g1) / (maxColor - minColor);
        }
    }
    L = L * 100;
    S = S * 100;
    H = H * 60;
    if (H < 0) {
        H += 360;
    }
    return {h:H, s:S, l:L};
}

export function colorShadeName(hsl) {
    let l = Math.floor(hsl.l), s = Math.floor(hsl.s), h = Math.floor(hsl.h);
    if (s <= 10 && l >= 90) {
        return ("white")
    } else if (l <= 15) {
        return ("black")
    } else if ((s <= 10 && l <= 70) || s === 0) {
        return ("gray")
    } else if ((h >= 0 && h <= 15) || h >= 346) {
        return ("red");
    } else if (h >= 16 && h <= 35) {
        if (s < 90) {
            return ("brown");
        } else {
            return ("orange");
        }
    } else if (h >= 36 && h <= 54) {
        if (s < 90) {
            return ("brown");
        } else {
            return ("yellow");
        }
    } else if (h >= 55 && h <= 165) {
        return ("green");
    } else if (h >= 166 && h <= 195) {
        return ("cyan");
    } else if (h >= 196 && h <= 260) {
        return ("blue")
    } else if (h >= 261 && h <= 290) {
        return ("purple")
    } else if (h >= 291 && h <= 345) {
        return ("pink")
    }
};