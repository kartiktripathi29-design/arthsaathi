-- Salary figures don't belong in the activity log. The net pay stays on SalarySlip, where it's used.
UPDATE "ActivityEvent"
SET "metadata" = "metadata" - 'netPay'
WHERE "eventType" = 'SALARY_PARSE_SUCCESS' AND "metadata" ? 'netPay';
