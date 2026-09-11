export function overlayCaptureAreaId(block: unknown, areaId: string): unknown {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error("area_capture_info chrome must be an object");
  }
  const record = block as Record<string, unknown>;
  const inner = record.area_capture_info;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) {
    throw new Error("area_capture_info.area_capture_info is required");
  }
  return {
    ...record,
    area_capture_info: { ...inner, area_id: areaId },
  };
}
