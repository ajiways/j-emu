export class HuntLook {
  constructor(
    readonly nick: string,
    readonly swf: string,
    readonly scale: number,
    readonly fps: number,
    readonly speed: number,
    readonly avatar: string,
    readonly kind: number,
    readonly hideOnMap: number,
    readonly sk: string,
    readonly body: string,
  ) {
    if (!nick) throw new Error("Hunt look nick is required");
    if (typeof swf !== "string") throw new Error("Hunt look swf is required");
    if (typeof avatar !== "string") throw new Error("Hunt look avatar is required");
    if (typeof sk !== "string") throw new Error("Hunt look sk is required");
    if (typeof body !== "string") throw new Error("Hunt look body is required");
    if (!Number.isInteger(scale) || scale < 1) throw new Error("Hunt look scale is invalid");
    if (!Number.isInteger(fps) || fps < 1) throw new Error("Hunt look fps is invalid");
    if (!Number.isInteger(speed) || speed < 0) throw new Error("Hunt look speed is invalid");
    if (!Number.isInteger(kind) || kind < 0) throw new Error("Hunt look kind is invalid");
    if (hideOnMap !== 0 && hideOnMap !== 1) throw new Error("Hunt look hideOnMap must be 0 or 1");
  }
}
