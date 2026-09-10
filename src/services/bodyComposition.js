const numeric = (value) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const rounded = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function calculateBodyComposition(values = {}) {
  const weightKg = numeric(values.weightKg);
  const heightCm = numeric(values.heightCm);
  const waistCm = numeric(values.waistCm);
  const neckCm = numeric(values.neckCm);
  const hipCm = numeric(values.hipCm);
  const sex = String(values.sex || "");

  const bmi = weightKg != null && heightCm > 0
    ? rounded(weightKg / ((heightCm / 100) ** 2), 2)
    : null;

  if (!sex) {
    return { bmi, bodyFatPct: null, bodyFatState: "idle", bodyFatMessage: "Seleccioná sexo para calcular la grasa corporal." };
  }

  const missing = [];
  if (heightCm == null) missing.push("altura");
  if (waistCm == null) missing.push("cintura");
  if (neckCm == null) missing.push("cuello");
  if (sex === "female" && hipCm == null) missing.push("cadera");
  if (missing.length) {
    return {
      bmi,
      bodyFatPct: null,
      bodyFatState: "incomplete",
      bodyFatMessage: `Para calcular con el método Navy falta${missing.length === 1 ? "" : "n"}: ${missing.join(", ")}.`,
    };
  }

  let density = null;
  if (sex === "male") {
    if (waistCm <= neckCm) {
      return { bmi, bodyFatPct: null, bodyFatState: "invalid", bodyFatMessage: "La cintura debe ser mayor que el cuello para calcular la estimación Navy." };
    }
    density = 1.0324 - (0.19077 * Math.log10(waistCm - neckCm)) + (0.15456 * Math.log10(heightCm));
  } else if (sex === "female") {
    if ((waistCm + hipCm) <= neckCm) {
      return { bmi, bodyFatPct: null, bodyFatState: "invalid", bodyFatMessage: "Cintura + cadera debe ser mayor que el cuello para calcular la estimación Navy." };
    }
    density = 1.29579 - (0.35004 * Math.log10(waistCm + hipCm - neckCm)) + (0.221 * Math.log10(heightCm));
  } else {
    return { bmi, bodyFatPct: null, bodyFatState: "invalid", bodyFatMessage: "Seleccioná Masculino o Femenino para la estimación Navy." };
  }

  const bodyFatPct = density > 0 ? rounded((495 / density) - 450, 2) : null;
  if (bodyFatPct == null || !Number.isFinite(bodyFatPct) || bodyFatPct < 1 || bodyFatPct > 75) {
    return {
      bmi,
      bodyFatPct: null,
      bodyFatState: "invalid",
      bodyFatMessage: "Las medidas producen una estimación fuera del rango válido. Revisá cintura, cuello, cadera y altura.",
    };
  }

  return { bmi, bodyFatPct, bodyFatState: "valid", bodyFatMessage: `Grasa corporal estimada: ${bodyFatPct.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %.` };
}
