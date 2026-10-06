import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

// Dependency-free PNG encoder for our original, pixel-grid app icon.
const size = 512;
const pixels = Buffer.alloc(size * (size * 4 + 1));
function rect(x, y, width, height, hex) {
  const rgb = hex.match(/.{2}/g).map((value) => parseInt(value, 16));
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      const offset = py * (size * 4 + 1) + 1 + px * 4;
      pixels.set([...rgb, 255], offset);
    }
  }
}
rect(32, 32, 448, 448, 'eee8f3');
rect(48, 48, 416, 416, 'f8f6ed');
rect(48, 370, 416, 94, 'e0e7d4');
rect(154, 320, 208, 72, '9a87c6');
rect(174, 264, 168, 88, 'f1c5a3');
rect(166, 244, 184, 40, '775644');
rect(198, 291, 20, 20, '443344');
rect(292, 291, 20, 20, '443344');
rect(184, 324, 30, 10, 'e59893');
rect(292, 324, 30, 10, 'e59893');
rect(186, 120, 84, 40, '9a87c6');
rect(164, 160, 156, 52, '9a87c6');
rect(144, 210, 190, 46, '9a87c6');
rect(270, 137, 64, 38, '9a87c6');
rect(156, 220, 160, 20, 'e8c983');
rect(118, 250, 248, 28, '756293');
rect(156, 354, 202, 70, '8f7c6a');
rect(168, 354, 82, 55, 'f9ead0');
rect(264, 354, 82, 55, 'e6d3b0');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(pixels)),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('resources', { recursive: true });
writeFileSync('resources/icon.png', png);
console.log('Generated resources/icon.png from original pixel art');
