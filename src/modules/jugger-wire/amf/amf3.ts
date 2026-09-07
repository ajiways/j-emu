export type AmfValue = null | boolean | number | string | AmfValue[] | { [key: string]: AmfValue };

class Writer {
  private readonly bytes: number[] = [];
  private readonly strings = new Map<string, number>();

  result(): Buffer {
    return Buffer.from(this.bytes);
  }

  write(value: AmfValue | undefined): void {
    if (value == null) return this.byte(0x01);
    if (value === false) return this.byte(0x02);
    if (value === true) return this.byte(0x03);
    if (typeof value === "number") {
      if (Number.isInteger(value) && value >= -0x10000000 && value < 0x10000000) {
        this.byte(0x04);
        this.u29(value < 0 ? (1 << 29) + value : value);
      } else {
        this.byte(0x05);
        const buffer = Buffer.alloc(8);
        buffer.writeDoubleBE(value);
        this.push(buffer);
      }
      return;
    }
    if (typeof value === "string") {
      this.byte(0x06);
      this.string(value);
      return;
    }
    if (Array.isArray(value)) {
      this.byte(0x09);
      this.u29((value.length << 1) | 1);
      this.string("");
      for (const item of value) this.write(item);
      return;
    }

    // The live PHP endpoint encodes maps as associative arrays.
    this.byte(0x09);
    this.u29(1);
    for (const [key, item] of Object.entries(value)) {
      this.string(key);
      this.write(item);
    }
    this.string("");
  }

  private byte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  private push(buffer: Buffer): void {
    for (const value of buffer) this.byte(value);
  }

  private u29(value: number): void {
    const unsigned = value >>> 0;
    if (unsigned < 0x80) return this.byte(unsigned);
    if (unsigned < 0x4000) {
      this.byte(((unsigned >> 7) & 0x7f) | 0x80);
      return this.byte(unsigned & 0x7f);
    }
    if (unsigned < 0x200000) {
      this.byte(((unsigned >> 14) & 0x7f) | 0x80);
      this.byte(((unsigned >> 7) & 0x7f) | 0x80);
      return this.byte(unsigned & 0x7f);
    }
    this.byte(((unsigned >> 22) & 0x7f) | 0x80);
    this.byte(((unsigned >> 15) & 0x7f) | 0x80);
    this.byte(((unsigned >> 8) & 0x7f) | 0x80);
    this.byte(unsigned & 0xff);
  }

  private string(value: string): void {
    if (value === "") return this.u29(1);
    const existing = this.strings.get(value);
    if (existing !== undefined) return this.u29(existing << 1);
    const encoded = Buffer.from(value, "utf8");
    this.u29((encoded.length << 1) | 1);
    this.push(encoded);
    this.strings.set(value, this.strings.size);
  }
}

class Reader {
  private position = 0;
  private readonly strings: string[] = [];
  private readonly objects: unknown[] = [];
  private readonly traits: Array<{ properties: string[]; dynamic: boolean }> = [];

  constructor(private readonly buffer: Buffer) {}

  read(): AmfValue {
    const marker = this.byte();
    switch (marker) {
      case 0x00:
      case 0x01:
        return null;
      case 0x02:
        return false;
      case 0x03:
        return true;
      case 0x04: {
        let value = this.u29();
        if (value >= 0x10000000) value -= 0x20000000;
        return value;
      }
      case 0x05:
        return this.take(8).readDoubleBE();
      case 0x06:
        return this.string();
      case 0x09:
        return this.array();
      case 0x0a:
        return this.object();
      default:
        throw new Error(`Unsupported AMF3 marker 0x${marker.toString(16)}`);
    }
  }

  private array(): AmfValue {
    const reference = this.u29();
    if ((reference & 1) === 0) return this.objects[reference >> 1] as AmfValue;
    const denseLength = reference >> 1;
    const associative: Record<string, AmfValue> = {};
    for (let key = this.string(); key !== ""; key = this.string()) {
      associative[key] = this.read();
    }
    const dense: AmfValue[] = [];
    for (let index = 0; index < denseLength; index += 1) dense.push(this.read());
    const value: AmfValue =
      Object.keys(associative).length === 0
        ? dense
        : dense.length === 0
          ? associative
          : { ...associative, _dense: dense };
    this.objects.push(value);
    return value;
  }

  private object(): AmfValue {
    const reference = this.u29();
    if ((reference & 1) === 0) return this.objects[reference >> 1] as AmfValue;
    let trait: { properties: string[]; dynamic: boolean };
    if ((reference & 2) === 0) {
      trait = this.traits[reference >> 2]!;
    } else {
      if (reference & 4) throw new Error("Externalizable AMF3 objects are unsupported");
      this.string();
      const properties = Array.from({ length: reference >> 4 }, () => this.string());
      trait = { properties, dynamic: Boolean(reference & 8) };
      this.traits.push(trait);
    }
    const value: Record<string, AmfValue> = {};
    for (const property of trait.properties) value[property] = this.read();
    if (trait.dynamic) {
      for (let key = this.string(); key !== ""; key = this.string()) value[key] = this.read();
    }
    this.objects.push(value);
    return value;
  }

  private byte(): number {
    if (this.position >= this.buffer.length) throw new Error("Unexpected AMF3 EOF");
    return this.buffer[this.position++]!;
  }

  private take(length: number): Buffer {
    if (this.position + length > this.buffer.length) throw new Error("Unexpected AMF3 EOF");
    const value = this.buffer.subarray(this.position, this.position + length);
    this.position += length;
    return value;
  }

  private u29(): number {
    let value = 0;
    for (let index = 0; index < 4; index += 1) {
      const next = this.byte();
      if (index === 3) return (value << 8) | next;
      value = (value << 7) | (next & 0x7f);
      if ((next & 0x80) === 0) return value;
    }
    throw new Error("Invalid U29");
  }

  private string(): string {
    const reference = this.u29();
    if ((reference & 1) === 0) return this.strings[reference >> 1]!;
    const value = this.take(reference >> 1).toString("utf8");
    if (value) this.strings.push(value);
    return value;
  }
}

export function encodeAmf3(value: AmfValue): Buffer {
  const writer = new Writer();
  writer.write(value);
  return writer.result();
}

export function decodeAmf3(value: Buffer | Uint8Array): AmfValue {
  return new Reader(Buffer.isBuffer(value) ? value : Buffer.from(value)).read();
}
