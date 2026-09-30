const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// Run against the compiled app with mocked requests; no production data is used.
const path = require("node:path");
const output = process.env.QA_OUTPUT_DIR || "/tmp/infytter-role-qa";
require("node:fs").mkdirSync(output, { recursive: true });
const assert = require("node:assert/strict");
const exercise = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Press banca",
  muscle_group: "Pecho",
  equipment: "Barra",
  image_url: "/images/muscles/male_muscle_04.webp",
  default_sets: 3,
  default_reps: "10",
  rest_seconds: 60,
  is_system: false,
  notes: "Bajá la barra con control.",
};
const routine = {
  id: "routine-1",
  title: "Fuerza inicial",
  sourceType: "professor",
  scheduleDays: [1, 2, 3, 4, 5, 6, 7],
  assignedPersonIds: ["person-1"],
  items: [
    {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: 3,
      reps: "10",
      rest_seconds: 60,
    },
  ],
};
const people = [
  {
    id: "person-1",
    name: "Tomás Fernández",
    dni: "30123456",
    role: "Cliente",
    branch: "centro",
    plan: "Full",
    start: "2026-08-01",
    expiry: "2026-10-31",
  },
  {
    id: "person-2",
    name: "Lucía Pérez",
    dni: "30123457",
    role: "Cliente",
    branch: "norte",
    plan: "Full",
    expiry: "2026-10-31",
  },
];
async function mock(page, role) {
  let failCatalog = false;
  const calls = [];
  const uid = "6fd819fe-131d-4278-8a5c-df69b5c2530e";
  const user = {
    id: uid,
    email: role + "@example.test",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {
      name: role === "cliente" ? "Tomás Fernández" : "Martín López",
    },
  };
  await page.route("**/*.supabase.co/**", async (route) => {
    const url = route.request().url();
    calls.push(url);
    let data = {};
    if (url.includes("/auth/v1/token"))
      data = {
        access_token:
          "eyJhbGciOiJIUzI1NiJ9." +
          Buffer.from(
            JSON.stringify({
              sub: uid,
              exp: Math.floor(Date.now() / 1000) + 3600,
              role: "authenticated",
            }),
          ).toString("base64url") +
          ".signature",
        refresh_token: "fixture",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    else if (url.includes("/auth/v1/user")) data = user;
    else if (url.includes("/gf_profiles"))
      data = {
        user_id: uid,
        email: user.email,
        display_name: user.user_metadata.name,
        role,
        is_master: false,
      };
    else if (url.includes("/gf_exercises")) {
      if (failCatalog) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Error simulado de biblioteca" }),
        });
        return;
      }
      data = [exercise];
    } else if (url.includes("gf_get_my_platform_access"))
      data = {
        allowed: true,
        linked: true,
        reason: "active",
        personId: "person-1",
      };
    else if (url.includes("gf_get_my_client_portal"))
      data = { member: people[0], accesses: [] };
    else if (url.includes("gf_get_gym_state"))
      data = {
        branches: [
          { id: "centro", name: "Junín" },
          { id: "norte", name: "Chacabuco" },
        ],
        activeBranch: "centro",
        people,
        accesses: [],
        transactions: [],
      };
    else if (url.includes("gf_get_my_routines"))
      data = { personal: [], assigned: [routine] };
    else if (url.includes("gf_list_professor_routines")) data = [routine];
    else if (url.includes("gf_list_routine_clients"))
      data = people.map((p) => ({
        person_id: p.id,
        display_name: p.name,
        dni: p.dni,
      }));
    else if (url.includes("gf_get_person_routines_for_professor")) {
      const id = JSON.parse(route.request().postData() || "{}").p_person_id;
      if (id === "person-1") await new Promise((r) => setTimeout(r, 700));
      data = [{ ...routine, title: id + " · Fuerza inicial" }];
    } else if (url.includes("body_metrics"))
      data = {
        items: [],
        personId: JSON.parse(route.request().postData() || "{}").p_person_id,
      };
    else if (url.includes("workout_history"))
      data = { recent: [], lastByExercise: {} };
    else if (url.includes("training_overview"))
      data = { sessions: [], items: [], summary: {} };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  return { calls, setFailure: (v) => (failCatalog = v) };
}
async function login(page, role) {
  const controls = await mock(page, role);
  await page.goto("http://127.0.0.1:5174");
  await page.locator("input[type=email]").fill(role + "@example.test");
  await page.locator("input[type=password]").fill("Fixture123!");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  return controls;
}
(async () => {
  const server = require("node:child_process").spawn(
    process.execPath,
    ["server/index.js"],
    {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, PORT: "5174", HOST: "127.0.0.1" },
      stdio: "ignore",
    },
  );
  await new Promise((r) => setTimeout(r, 700));
  try {
    for (const role of ["cliente", "profe"]) {
      const browser = await chromium.launch({
        executablePath: process.env.QA_BROWSER_PATH || undefined,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
        headless: true,
      });
      try {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const controls = await login(page, role);
        if (role === "cliente") {
          await page
            .getByRole("button", { name: "Entrenar", exact: true })
            .waitFor();
          await page.screenshot({
            path: path.join(output, "qa-alumno-inicio.png"),
            fullPage: true,
          });
          await page
            .getByRole("button", { name: "Entrenar", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Crear rutina personal" })
            .click();
          await page
            .getByRole("dialog", { name: "Nueva rutina", exact: true })
            .waitFor();
          assert.equal(
            await page.evaluate(() => document.body.style.overflow),
            "hidden",
          );
          await page
            .getByRole("button", { name: "Elegir Press banca", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Desmarcar Press banca", exact: true })
            .click();
          await page.getByText("0 elegidos", { exact: true }).waitFor();
          await page
            .getByRole("button", {
              name: "Ver ejercicio: Press banca",
              exact: true,
            })
            .last()
            .click();
          await page
            .getByRole("dialog", { name: "Consultar ejercicio", exact: true })
            .waitFor();
          await page
            .getByRole("button", { name: /Abrir en pantalla completa/ })
            .last()
            .click();
          await page.getByRole("button", { name: "Aumentar zoom" }).click();
          await page.getByRole("button", { name: "Restablecer zoom" }).focus();
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .getByRole("button", { name: "Cerrar pantalla completa" })
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await page.getByText("150%", { exact: true }).waitFor();
          await page
            .getByRole("button", { name: "Cerrar pantalla completa" })
            .click();
          await page.keyboard.press("Escape");
          assert.equal(
            await page
              .getByRole("dialog", { name: "Consultar ejercicio", exact: true })
              .count(),
            0,
          );
          assert.equal(
            await page
              .getByRole("dialog", { name: "Nueva rutina", exact: true })
              .count(),
            1,
          );
          await page.keyboard.press("Escape");
          assert.equal(
            await page.evaluate(() => document.body.style.overflow),
            "",
          );
          await page
            .getByRole("button", { name: "Ejercicios", exact: true })
            .click();
          await page.getByRole("button", { name: /Mapa muscular/ }).click();
          await page
            .getByRole("button", { name: "Mujer", exact: true })
            .click();
          await page.screenshot({
            path: path.join(output, "qa-alumno-ejercicios.png"),
            fullPage: true,
          });
          await page.getByLabel("Buscar ejercicios").fill("noexistente123");
          await page
            .getByRole("button", { name: "Limpiar filtros", exact: true })
            .click();
          await page.getByText("1 ejercicio", { exact: true }).waitFor();
          await page
            .getByRole("button", { name: "Inicio", exact: true })
            .click();
          controls.setFailure(true);
          await page
            .getByRole("button", { name: "Ejercicios", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Volver a intentar", exact: true })
            .waitFor();
          controls.setFailure(false);
          await page
            .getByRole("button", { name: "Volver a intentar", exact: true })
            .click();
          await page.getByText("1 ejercicio", { exact: true }).waitFor();
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page
            .getByRole("button", { name: "Inicio", exact: true })
            .click();
          await page.waitForTimeout(150);
          await page.screenshot({
            path: path.join(output, "qa-alumno-desktop.png"),
            fullPage: true,
          });
        } else {
          await page
            .getByRole("link", { name: "Ver progreso", exact: true })
            .first()
            .waitFor();
          await page.screenshot({
            path: path.join(output, "qa-profesor-inicio.png"),
            fullPage: true,
          });
          await page
            .getByRole("link", { name: "Ver progreso", exact: true })
            .first()
            .click();
          await page.getByRole("button", { name: /Tomás Fernández/ }).waitFor();
          assert.equal(
            await page
              .getByRole("button", { name: /Tomás Fernández/ })
              .getAttribute("aria-pressed"),
            "true",
          );
          await page.getByLabel("Sucursal").selectOption("norte");
          await page
            .getByText("Seleccioná un alumno", { exact: true })
            .waitFor();
          assert.equal(
            await page
              .getByRole("heading", { name: "Tomás Fernández", exact: true })
              .count(),
            0,
          );
          await page.getByLabel("Sucursal").selectOption("centro");
          await page.getByRole("link", { name: "Inicio", exact: true }).click();
          await page
            .getByRole("link", { name: "Ver rutinas", exact: true })
            .first()
            .click();
          await page.getByLabel("Alumno para consultar rutinas").waitFor();
          assert.equal(
            await page.getByLabel("Alumno para consultar rutinas").inputValue(),
            "person-1",
          );
          await page
            .getByLabel("Alumno para consultar rutinas")
            .selectOption("person-2");
          await page
            .getByText("person-2 · Fuerza inicial", { exact: true })
            .waitFor();
          await page.waitForTimeout(850);
          assert.equal(
            await page
              .getByText("person-1 · Fuerza inicial", { exact: true })
              .count(),
            0,
          );
          await page
            .getByRole("button", { name: "Mis rutinas", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Enviar", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Enviar a 0 alumnos", exact: true })
            .waitFor();
          assert.equal(
            await page
              .getByRole("button", { name: "Enviar a 0 alumnos", exact: true })
              .isDisabled(),
            true,
          );
          await page.getByLabel("Lucía Pérez", { exact: false }).check();
          assert.equal(
            await page
              .getByRole("button", { name: "Enviar a 1 alumno", exact: true })
              .isEnabled(),
            true,
          );
          await page.screenshot({
            path: path.join(output, "qa-profesor-enviar.png"),
            fullPage: true,
          });
          await page.keyboard.press("Escape");
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.getByRole("link", { name: "Inicio", exact: true }).click();
          await page.waitForTimeout(150);
          await page.screenshot({
            path: path.join(output, "qa-profesor-desktop.png"),
            fullPage: true,
          });
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.deepEqual(errors, []);
        console.log(
          role +
            ": OK; mobile/desktop, navigation, dialogs and role interactions",
        );
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
