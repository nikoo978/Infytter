import test from "node:test";
import assert from "node:assert/strict";
import { PROFESSOR_PERMISSIONS, professorPermissionEnabled } from "../src/services/professorPermissions.js";
const all = Object.fromEntries(PROFESSOR_PERMISSIONS.map(({ column }) => [column, true]));
test("professor permissions are opt-in and prerequisites cannot be bypassed", () => {
  for (const { key } of PROFESSOR_PERMISSIONS) {
    assert.equal(professorPermissionEnabled({}, key), false);
    assert.equal(professorPermissionEnabled(all, key), true);
  }
  const noStudents = { ...all, can_view_students: false };
  for (const key of ["canViewStudentProgress", "canRecordStudentMetrics", "canDeleteStudentMetrics", "canViewStudentRoutines", "canAssignRoutines"]) assert.equal(professorPermissionEnabled(noStudents, key), false);
  assert.equal(professorPermissionEnabled(noStudents, "canCreateRoutines"), true);
  assert.equal(professorPermissionEnabled({ ...all, can_view_exercises: false }, "canEditRoutines"), false);
  assert.equal(professorPermissionEnabled({ ...all, can_view_routines: false }, "canAssignRoutines"), false);
  assert.equal(professorPermissionEnabled({ ...all, can_view_student_progress: false }, "canRecordStudentMetrics"), false);
});
