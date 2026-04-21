// K-12 SIS / gradebook schema. FERPA-aligned: grade access is logged; parent
// access to a child's grades is explicitly flagged (canAccessGrades).
import { pgTable, uuid, varchar, timestamp, integer, text, boolean, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const teacherRoleEnum = pgEnum('teacher_role', ['teacher', 'admin', 'counselor'])
export const parentRelationshipEnum = pgEnum('parent_relationship', ['mother', 'father', 'guardian', 'other'])
export const gradeLetterEnum = pgEnum('grade_letter', ['A', 'B', 'C', 'D', 'F', 'I', 'P', 'NP'])

export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    districtStudentId: varchar('district_student_id', { length: 64 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    grade: integer('grade').notNull(), // K=0, 1-12
    birthDate: timestamp('birth_date', { withTimezone: false }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    sisExternalId: varchar('sis_external_id', { length: 128 }),
  },
  (t) => ({ districtUniq: uniqueIndex('students_district_uniq').on(t.districtStudentId) }),
)

export const teachers = pgTable(
  'teachers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    districtStaffId: varchar('district_staff_id', { length: 64 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    role: teacherRoleEnum('role').notNull().default('teacher'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ emailUniq: uniqueIndex('teachers_email_uniq').on(t.email) }),
)

export const classes = pgTable(
  'classes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 64 }).notNull(), // Math, ELA, Science, etc.
    academicYear: varchar('academic_year', { length: 9 }).notNull(), // "2025-2026"
    term: varchar('term', { length: 16 }).notNull(), // "Fall", "Spring", "Q1"
    teacherId: uuid('teacher_id').notNull().references(() => teachers.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeYearUniq: uniqueIndex('classes_code_year_uniq').on(t.code, t.academicYear, t.term),
  }),
)

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    droppedAt: timestamp('dropped_at', { withTimezone: true }),
  },
  (t) => ({
    classStudentUniq: uniqueIndex('enrollments_class_student_uniq').on(t.classId, t.studentId),
  }),
)

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    totalPoints: integer('total_points').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ classIdx: index('assignments_class_idx').on(t.classId) }),
)

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    content: text('content'),
    attachments: jsonb('attachments').$type<Array<{ uri: string; filename: string }>>().default([]),
  },
  (t) => ({
    assignmentStudentUniq: uniqueIndex('submissions_assignment_student_uniq').on(t.assignmentId, t.studentId),
  }),
)

export const grades = pgTable(
  'grades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
    pointsEarned: integer('points_earned').notNull(),
    letter: gradeLetterEnum('letter'),
    gradedByTeacherId: uuid('graded_by_teacher_id').notNull().references(() => teachers.id),
    gradedAt: timestamp('graded_at', { withTimezone: true }).notNull().defaultNow(),
    // Grade amendments are new rows referencing the prior row — never UPDATE an existing grade.
    amendmentOfGradeId: uuid('amendment_of_grade_id'),
    comment: text('comment'),
  },
  (t) => ({ submissionIdx: index('grades_submission_idx').on(t.submissionId) }),
)

export const parents = pgTable('parents', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const parentStudents = pgTable(
  'parent_students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').notNull().references(() => parents.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    relationship: parentRelationshipEnum('relationship').notNull(),
    canAccessGrades: boolean('can_access_grades').notNull().default(true),
    // Set to false when a court order restricts the parent's access (non-custodial).
    custodialRights: boolean('custodial_rights').notNull().default(true),
  },
  (t) => ({
    parentStudentUniq: uniqueIndex('parent_students_uniq').on(t.parentId, t.studentId),
  }),
)

/** FERPA-aligned audit log: one row per grade/record disclosure. */
export const gradeAccessLogs = pgTable('grade_access_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: varchar('actor_id', { length: 128 }).notNull(),
  actorRole: varchar('actor_role', { length: 32 }).notNull(), // 'teacher' | 'admin' | 'parent' | 'student'
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  assignmentId: uuid('assignment_id').references(() => assignments.id, { onDelete: 'set null' }),
  accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
  ipAddress: varchar('ip_address', { length: 45 }),
})

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(teachers, { fields: [classes.teacherId], references: [teachers.id] }),
  enrollments: many(enrollments),
  assignments: many(assignments),
}))

export const studentsRelations = relations(students, ({ many }) => ({
  enrollments: many(enrollments),
  submissions: many(submissions),
  parentLinks: many(parentStudents),
}))

export type Student = typeof students.$inferSelect
export type Teacher = typeof teachers.$inferSelect
export type Class = typeof classes.$inferSelect
export type Assignment = typeof assignments.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type Grade = typeof grades.$inferSelect
export type Parent = typeof parents.$inferSelect
export type ParentStudent = typeof parentStudents.$inferSelect
