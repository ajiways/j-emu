import { decodeAmf3, encodeAmf3, type AmfValue } from "./amf3.ts";
import { toAmfValue } from "./to-amf-value.ts";

function encodeFrame(payload: AmfValue): Buffer {
  const body = encodeAmf3(payload);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}

export function encodeFrames(payloads: readonly AmfValue[]): Buffer {
  return Buffer.concat(payloads.map(encodeFrame));
}

export function encodePlainFrames(payloads: readonly unknown[]): Buffer {
  return encodeFrames(payloads.map(toAmfValue));
}

export function decodeFrames(buffer: Buffer): AmfValue[] {
  const frames: AmfValue[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) throw new Error("Incomplete AMF frame header");
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    if (offset + length > buffer.length) throw new Error("Incomplete AMF frame body");
    frames.push(decodeAmf3(buffer.subarray(offset, offset + length)));
    offset += length;
  }
  return frames;
}
