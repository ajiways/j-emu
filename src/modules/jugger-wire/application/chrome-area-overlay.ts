function numericAreaId(areaId: string): number {
  if (!areaId) throw new Error("Area id is required");
  const parsed = Number(areaId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Area id ${areaId} is not a positive integer`);
  }
  return parsed;
}

export function overlayChromeAreaId(block: unknown, areaId: string, field: string): unknown {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error(`${field} chrome must be an object`);
  }
  return { ...block, area_id: numericAreaId(areaId) };
}

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
