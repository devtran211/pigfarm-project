function parseCapacity(raw) {
  if (!raw) throw new Error("Capacity trống");
  const s = String(raw).replace(/\s+/g, "").toLowerCase();
  const m = s.match(/^([\d.]+)([a-z]+)$/i);
  if (!m) throw new Error(`Không parse được capacity: "${raw}"`);
  const amount = parseFloat(m[1]);
  const unit = m[2];
  return { amount, unit };
}

function toBaseUnit(amount, unit) {
  const u = unit.toLowerCase();
  if (u === "kg") return { base: amount * 1000, type: "mass" }; // gram
  if (u === "g") return { base: amount, type: "mass" };
  if (u === "l" || u === "lt" || u === "litre" || u === "liter") return { base: amount * 1000, type: "volume" }; // ml
  if (u === "ml") return { base: amount, type: "volume" };
  throw new Error(`Đơn vị không hỗ trợ: ${unit}`);
}

function normalizeWeightToKg(weight, unit) {
  const u = (unit || 'kg').toLowerCase();
  if (u === 'kg') return Number(weight || 0);
  if (u === 'g') return Number(weight || 0) / 1000;
  throw new Error(`Đơn vị weight không hỗ trợ: ${unit}`);
}

module.exports = { parseCapacity, toBaseUnit, normalizeWeightToKg };