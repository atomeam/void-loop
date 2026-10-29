# PixelLab Integration

This directory contains integrations for external APIs used in the Adventure emulator project.

## PixelLab (pixellab.ai)

Pixel art generation API for game assets - characters, animations, tilesets, and more.

### Setup

The API key is configured in `.env`:
```
PIXELLAB_SECRET=your-secret-key
PIXELLAB_BASE_URL=https://api.pixellab.ai/v1
```

### Usage

```javascript
import { PixelLabClient } from "@pixellab-code/pixellab";

const client = new PixelLabClient(process.env.PIXELLAB_SECRET);

// Generate a character
const response = await client.generateImagePixflux({
    description: "brave knight in shining armor",
    imageSize: { width: 64, height: 64 },
    noBackground: true,
});

await response.image.saveToFile("knight.png");
```

### Available Features

- **Generate Image** (Pixflux, Pixen, Bitforge models)
- **Image Operations** (resize, pixelate, remove background)
- **Animation** (animate with text, skeleton)
- **Tilesets** (create tilesets, isometric tiles)
- **Characters** (create characters with 4 directions, animate)

### Test the Integration

```bash
npm run pixellab:test
```

This will check your API balance and verify the connection.

### Documentation

- [PixelLab API Documentation](https://www.pixellab.ai/pixellab-api)
- [JavaScript SDK](https://github.com/pixellab-code/pixellab-js)
