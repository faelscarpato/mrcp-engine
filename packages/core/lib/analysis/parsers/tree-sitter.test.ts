import { describe, it, expect } from "vitest";
import {
  extractFunctionsWithTreeSitter,
  extractCallsWithTreeSitter,
  extractImportsWithTreeSitter
} from "./tree-sitter.js";

describe("Tree-sitter AST Parsers & WASM Pipeline", () => {
  it("should extract functions, calls, and imports from TypeScript", async () => {
    const tsCode = `
      import { foo } from "./foo";
      import defaultBar from "bar";

      export function calculateTotal(a: number, b: number): number {
        if (a > 10) {
          foo(a);
        }
        return a + b;
      }
    `;

    const fnResult = await extractFunctionsWithTreeSitter("src/calc.ts", tsCode, "typescript");
    expect(fnResult.functions.length).toBeGreaterThanOrEqual(1);
    expect(fnResult.functions[0].name).toBe("calculateTotal");
    expect(fnResult.functions[0].complexity).toBeGreaterThanOrEqual(2);

    const callResult = await extractCallsWithTreeSitter("src/calc.ts", tsCode, "typescript");
    expect(callResult.some((c) => c.calleeName === "foo")).toBe(true);

    const importResult = await extractImportsWithTreeSitter("src/calc.ts", tsCode, "typescript");
    expect(importResult.imports.some((i) => i.raw === "./foo")).toBe(true);
    expect(importResult.imports.some((i) => i.raw === "bar")).toBe(true);
  });

  it("should extract methods and imports from Python", async () => {
    const pyCode = `
from os import path
import sys

def process_data(items):
    for item in items:
        if item > 0:
            print(item)
    return len(items)
`;

    const fnResult = await extractFunctionsWithTreeSitter("script.py", pyCode, "python");
    expect(fnResult.functions.length).toBeGreaterThanOrEqual(1);
    expect(fnResult.functions[0].name).toBe("process_data");
    expect(fnResult.functions[0].complexity).toBeGreaterThanOrEqual(2);

    const importResult = await extractImportsWithTreeSitter("script.py", pyCode, "python");
    expect(importResult.imports.some((i) => i.raw === "os" || i.raw === "sys")).toBe(true);
  });

  it("should extract SAP CDS view definitions and associations", async () => {
    const cdsCode = `
using { Country } from './common';

define root view entity ZI_SalesOrder
  as select from zsales_order
{
  key order_id as OrderId,
      customer_id as CustomerId,
      _Country
}
`;

    const fnResult = await extractFunctionsWithTreeSitter("sales.cds", cdsCode, "cds");
    expect(fnResult.functions.length).toBeGreaterThanOrEqual(1);
    expect(fnResult.functions[0].name).toBe("ZI_SalesOrder");

    const importResult = await extractImportsWithTreeSitter("sales.cds", cdsCode, "cds");
    expect(importResult.imports.some((i) => i.raw.includes("./common"))).toBe(true);
  });

  it("should extract SAP ABAP methods and implementations", async () => {
    const abapCode = `
CLASS zcl_invoice_service DEFINITION.
  PUBLIC SECTION.
    METHODS process_invoice IMPORTING iv_id TYPE string.
ENDCLASS.

CLASS zcl_invoice_service IMPLEMENTATION.
  METHOD process_invoice.
    IF iv_id IS NOT INITIAL.
      CALL METHOD me->validate( iv_id ).
    ENDIF.
  ENDMETHOD.
ENDCLASS.
`;

    const fnResult = await extractFunctionsWithTreeSitter("zcl_invoice.abap", abapCode, "abap");
    expect(fnResult.functions.length).toBeGreaterThanOrEqual(1);
    expect(fnResult.functions.some((f) => f.name.includes("process_invoice"))).toBe(true);

    const callResult = await extractCallsWithTreeSitter("zcl_invoice.abap", abapCode, "abap");
    expect(callResult.length).toBeGreaterThanOrEqual(0);
  });

  it("should extract Oracle PL/SQL package and procedure definitions", async () => {
    const plsqlCode = `
CREATE OR REPLACE PACKAGE BODY emp_mgmt AS
  PROCEDURE hire_employee(
    p_emp_id IN NUMBER,
    p_name   IN VARCHAR2
  ) IS
  BEGIN
    IF p_emp_id > 0 THEN
      INSERT INTO employees (id, name) VALUES (p_emp_id, p_name);
    END IF;
  END hire_employee;
END emp_mgmt;
`;

    const fnResult = await extractFunctionsWithTreeSitter("emp_mgmt.sql", plsqlCode, "oracle_plsql");
    expect(fnResult.functions.length).toBeGreaterThanOrEqual(1);
    expect(fnResult.functions.some((f) => f.name.includes("emp_mgmt") || f.name.includes("hire_employee"))).toBe(true);
  });
});
