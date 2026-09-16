function params(value = "") {
  return new URLSearchParams(String(value || "").replace(/^[?#]/, ""));
}

export function emailConfirmationResult(locationLike = typeof window !== "undefined" ? window.location : null) {
  const search = params(locationLike?.search);
  const hash = params(locationLike?.hash);
  const errorCode = hash.get("error_code") || search.get("error_code") || hash.get("error") || search.get("error") || "";
  const errorDescription = hash.get("error_description") || search.get("error_description") || "";

  if (errorCode) {
    return {
      status: "error",
      errorCode,
      message: errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "El enlace de confirmación no pudo completarse. Puede haber vencido o ya haber sido utilizado.",
    };
  }

  if (search.get("email_confirmado") === "1") return { status: "success", errorCode: "", message: "" };
  return { status: "unknown", errorCode: "", message: "" };
}
