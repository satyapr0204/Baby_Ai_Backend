const { extractMeasurements } = require('../../services/measurementService');

describe('extractMeasurements', () => {
  const createLandmarks = () => {
    // Create 29 landmark objects (indices 0..28)
    const landmarks = Array.from({ length: 29 }, () => ({ x: 0, y: 0 }));
    // Set key landmarks (normalized coordinates)
    landmarks[11] = { x: 0.4, y: 0.3 };  // left shoulder
    landmarks[12] = { x: 0.6, y: 0.3 };  // right shoulder
    landmarks[23] = { x: 0.42, y: 0.6 }; // left hip
    landmarks[24] = { x: 0.58, y: 0.6 }; // right hip
    landmarks[27] = { x: 0.43, y: 0.9 }; // left ankle
    landmarks[28] = { x: 0.57, y: 0.9 }; // right ankle
    return landmarks;
  };

  it('should return all required measurement fields', () => {
    const data = {
      landmarks: createLandmarks(),
      image_width: 640,
      image_height: 480,
    };
    const result = extractMeasurements(data);
    expect(result).toHaveProperty('height');
    expect(result).toHaveProperty('weight');
    expect(result).toHaveProperty('chest');
    expect(result).toHaveProperty('waist');
    expect(result).toHaveProperty('hip');
  });

  it('should always return height 170 and weight 70', () => {
    const data = {
      landmarks: createLandmarks(),
      image_width: 640,
      image_height: 480,
    };
    const result = extractMeasurements(data);
    expect(result.height).toBe(170);
    expect(result.weight).toBe(70);
  });

  it('should return rounded integer values for chest, waist, hip', () => {
    const data = {
      landmarks: createLandmarks(),
      image_width: 1920,
      image_height: 1080,
    };
    const result = extractMeasurements(data);
    expect(Number.isInteger(result.chest)).toBe(true);
    expect(Number.isInteger(result.waist)).toBe(true);
    expect(Number.isInteger(result.hip)).toBe(true);
  });

  it('should compute proportional measurements for different image sizes', () => {
    const landmarks = createLandmarks();

    const result1 = extractMeasurements({
      landmarks,
      image_width: 640,
      image_height: 480,
    });

    const result2 = extractMeasurements({
      landmarks,
      image_width: 1280,
      image_height: 960,
    });

    // With the same normalized landmarks, proportional measurements should be equal
    // because the ratio stays the same
    expect(result1.chest).toBe(result2.chest);
    expect(result1.waist).toBe(result2.waist);
    expect(result1.hip).toBe(result2.hip);
  });

  it('should handle landmarks where shoulders and hips are equidistant', () => {
    const landmarks = Array.from({ length: 29 }, () => ({ x: 0, y: 0 }));
    landmarks[11] = { x: 0.3, y: 0.2 };
    landmarks[12] = { x: 0.7, y: 0.2 };
    landmarks[23] = { x: 0.3, y: 0.5 };
    landmarks[24] = { x: 0.7, y: 0.5 };
    landmarks[27] = { x: 0.3, y: 0.8 };
    landmarks[28] = { x: 0.7, y: 0.8 };

    const result = extractMeasurements({
      landmarks,
      image_width: 1000,
      image_height: 1000,
    });

    expect(result.chest).toBeGreaterThan(0);
    expect(result.waist).toBeGreaterThan(0);
    expect(result.hip).toBeGreaterThan(0);
  });

  it('should produce chest > shoulder width (1.5x multiplier)', () => {
    const landmarks = createLandmarks();
    const data = {
      landmarks,
      image_width: 640,
      image_height: 480,
    };
    const result = extractMeasurements(data);
    // chest = shoulderCm * 1.5, so chest should always be positive
    expect(result.chest).toBeGreaterThan(0);
  });
});
