#!/usr/bin/env node

/**
 * Icon generation script for PWA
 *
 * This script generates PNG icons from the SVG source.
 *
 * To run this script, you need to install sharp:
 * npm install sharp --save-dev
 *
 * Then run:
 * node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Creating placeholder icons...');
  console.log('To generate proper icons, run: npm install sharp --save-dev');
  console.log('Then run this script again.\n');

  // Create placeholder PNG files
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');

  // Ensure directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Create a simple 1x1 purple pixel PNG as placeholder
  // This is a minimal valid PNG file
  const purplePixelPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xD8, 0x5D, 0xC6, 0xC0,
    0x00, 0x00, 0x01, 0x39, 0x00, 0xD3, 0x5B, 0x5C,
    0x3A, 0xB7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  sizes.forEach(size => {
    const filename = `icon-${size}x${size}.png`;
    const filepath = path.join(iconsDir, filename);
    fs.writeFileSync(filepath, purplePixelPNG);
    console.log(`Created placeholder: ${filename}`);
  });

  console.log('\nPlaceholder icons created. Replace with proper icons for production.');
  process.exit(0);
}

// If sharp is available, generate proper icons
const svgPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg');
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
