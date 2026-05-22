// function distance(p1, p2) {
//     return Math.sqrt(
//         Math.pow(p1.x - p2.x, 2) +
//         Math.pow(p1.y - p2.y, 2)
//     );
// }

// function extractMeasurements(data) {

//     const { landmarks, image_width, image_height } = data;

//     const toPixel = (p) => ({
//         x: p.x * image_width,
//         y: p.y * image_height
//     });

//     const leftShoulder = toPixel(landmarks[11]);
//     const rightShoulder = toPixel(landmarks[12]);

//     const leftHip = toPixel(landmarks[23]);
//     const rightHip = toPixel(landmarks[24]);

//     const leftAnkle = toPixel(landmarks[27]);
//     const rightAnkle = toPixel(landmarks[28]);

//     const shoulderWidthPx = distance(leftShoulder, rightShoulder);
//     const hipWidthPx = distance(leftHip, rightHip);

//     const bodyHeightPx =
//         ((leftAnkle.y + rightAnkle.y) / 2) -
//         ((leftShoulder.y + rightShoulder.y) / 2);

//     const heightCm = 170;
//     const scale = heightCm / bodyHeightPx;

//     const shoulderCm = shoulderWidthPx * scale;
//     const hipCm = hipWidthPx * scale;

//     const chestCm = shoulderCm * 1.35;
//     const waistCm = hipCm * 0.9;

//     return {
//         height: heightCm,
//         weight: 70,
//         chest: Math.round(chestCm),
//         waist: Math.round(waistCm),
//         hip: Math.round(hipCm)
//     };
// }

// module.exports = { extractMeasurements };

// ___________________________________________________________________________________________________________
function distance(p1, p2) {
    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2)
    );
}

function extractMeasurements(data) {

    const { landmarks, image_width, image_height } = data;

    const toPixel = (p) => ({
        x: p.x * image_width,
        y: p.y * image_height
    });

    const leftShoulder = toPixel(landmarks[11]);
    const rightShoulder = toPixel(landmarks[12]);

    const leftHip = toPixel(landmarks[23]);
    const rightHip = toPixel(landmarks[24]);

    const leftAnkle = toPixel(landmarks[27]);
    const rightAnkle = toPixel(landmarks[28]);

    const shoulderWidthPx = distance(leftShoulder, rightShoulder);
    const hipWidthPx = distance(leftHip, rightHip);

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const ankleY = (leftAnkle.y + rightAnkle.y) / 2;

    const bodyHeightPx = Math.abs(ankleY - shoulderY);

    // assume height
    const heightCm = 170;

    const pxPerCm = bodyHeightPx / heightCm;

    const shoulderCm = shoulderWidthPx / pxPerCm;
    const hipCm = hipWidthPx / pxPerCm;

    const chest = shoulderCm * 1.5;
    const waist = hipCm * 0.9;

    return {
        height: heightCm,
        weight: 70,
        chest: Math.round(chest),
        waist: Math.round(waist),
        hip: Math.round(hipCm * 1.4)
    };
}

module.exports = { extractMeasurements };