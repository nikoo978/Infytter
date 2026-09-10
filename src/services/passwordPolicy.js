export const PASSWORD_POLICY_SUMMARY = "Mínimo 8 caracteres, con al menos una minúscula, una mayúscula, un número y un símbolo.";

export const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "8 caracteres como mínimo", test: (value) => value.length >= 8 },
  { key: "lower", label: "1 letra minúscula", test: (value) => /[a-z]/.test(value) },
  { key: "upper", label: "1 letra mayúscula", test: (value) => /[A-Z]/.test(value) },
  { key: "number", label: "1 número", test: (value) => /[0-9]/.test(value) },
  { key: "symbol", label: "1 símbolo", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function passwordRequirementStatus(value = "") {
  const password = String(value || "");
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    met: requirement.test(password),
  }));
}

export function passwordPolicyError(value = "") {
  return passwordRequirementStatus(value).every((requirement) => requirement.met)
    ? ""
    : `La contraseña debe cumplir estos requisitos: ${PASSWORD_POLICY_SUMMARY}`;
}
