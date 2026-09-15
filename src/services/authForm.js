import { signupPasswordPolicyError } from "./passwordPolicy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const FIELD_ORDER = ["name", "dni", "email", "password"];

export function sanitizeDni(value = "") {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

export function validateAuthForm({ view = "login", name = "", dni = "", email = "", password = "" } = {}) {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  const cleanDni = sanitizeDni(dni);
  const cleanEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  const errors = {};

  if (view === "register") {
    if (!cleanName) errors.name = "Completá tu nombre y apellido.";
    else if (cleanName.length < 3) errors.name = "Usá al menos 3 caracteres.";
    else if (!/\S+\s+\S+/.test(cleanName)) errors.name = "Ingresá nombre y apellido.";

    if (!cleanDni) errors.dni = "Completá tu DNI.";
    else if (!/^[0-9]{6,10}$/.test(cleanDni)) errors.dni = "Ingresá entre 6 y 10 números, sin puntos ni espacios.";
  }

  if (!cleanEmail) errors.email = "Completá tu email.";
  else if (!EMAIL_PATTERN.test(cleanEmail)) errors.email = "Ingresá un email válido, por ejemplo nombre@correo.com.";

  if (view !== "reset") {
    if (!rawPassword) errors.password = "Completá la contraseña.";
    else if (view === "register") {
      const passwordError = signupPasswordPolicyError(rawPassword, { dni: cleanDni });
      if (passwordError) errors.password = passwordError;
    }
  }

  return {
    errors,
    values: {
      name: cleanName,
      dni: cleanDni,
      email: cleanEmail,
      password: rawPassword,
    },
  };
}

export function firstAuthErrorField(errors = {}) {
  return FIELD_ORDER.find((field) => Boolean(errors[field])) || null;
}

export function isAuthRateLimit(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 || code.startsWith("over_") || message.includes("rate limit") || message.includes("too many requests");
}

export function authRateLimitDetails(error, action = "login") {
  const code = String(error?.code || "").toLowerCase();

  if (code === "over_email_send_rate_limit") {
    return {
      code,
      retryAfterSeconds: 120,
      message: action === "register"
        ? "No pudimos completar el alta porque el servicio de correo alcanzó temporalmente su límite. Tus datos no están mal. No vuelvas a tocar Crear cuenta repetidamente: esperá un momento o pedí ayuda en recepción."
        : "El servicio de correo alcanzó temporalmente su límite. Esperá un momento antes de volver a solicitar el mensaje.",
    };
  }

  if (code === "over_request_rate_limit") {
    return {
      code,
      retryAfterSeconds: 60,
      message: "Esta conexión hizo demasiadas solicitudes en poco tiempo. Pausamos los reintentos durante un minuto para no prolongar el bloqueo.",
    };
  }

  return {
    code: code || "rate_limit",
    retryAfterSeconds: 60,
    message: action === "register"
      ? "El registro recibió demasiadas solicitudes seguidas. Pausamos los reintentos durante un minuto para evitar que el bloqueo se prolongue."
      : "Hubo demasiadas solicitudes seguidas. Esperá un minuto antes de volver a intentar.",
  };
}
