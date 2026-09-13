export const PASSWORD_POLICY_SUMMARY = "Mínimo 8 caracteres y al menos 1 número.";

export const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "8 caracteres como mínimo", test: (value) => value.length >= 8 },
  { key: "number", label: "1 número", test: (value) => /[0-9]/.test(value) },
];

const cleanDni = (value = "") => String(value || "").replace(/\D/g, "");

export function passwordRequirementStatus(value = "", dni = "") {
  const password = String(value || "");
  const status = PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    met: requirement.test(password),
  }));
  const normalizedDni = cleanDni(dni);
  if (normalizedDni) status.push({ key: "dni", label: "Distinta del DNI", met: password !== normalizedDni });
  return status;
}

export function passwordPolicyError(value = "", { dni = "" } = {}) {
  const password = String(value || "");
  if (!PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password))) {
    return `La contraseña debe cumplir estos requisitos: ${PASSWORD_POLICY_SUMMARY}`;
  }
  const normalizedDni = cleanDni(dni);
  if (normalizedDni && password === normalizedDni) return "La contraseña no puede ser igual al DNI.";
  return "";
}
