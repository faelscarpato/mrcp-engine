import { describe, it, expect } from "vitest";
import {
  extractFunctionsWithTreeSitter,
  extractCallsWithTreeSitter,
  extractImportsWithTreeSitter,
  LANGUAGE_WASM_MAP,
} from "./tree-sitter.js";

describe("Tree-sitter AST Parser Suite", () => {
  it("should verify grammar availability for core and enterprise languages", () => {
    expect(LANGUAGE_WASM_MAP["typescript"]).toBeDefined();
    expect(LANGUAGE_WASM_MAP["python"]).toBeDefined();
    expect(LANGUAGE_WASM_MAP["go"]).toBeDefined();
    expect(LANGUAGE_WASM_MAP["rust"]).toBeDefined();
    expect(LANGUAGE_WASM_MAP["java"]).toBeDefined();
  });

  describe("1. SAP CDS (Core Data Services)", () => {
    const cdsCode = `
      @EndUserText.label: 'Sales Order View'
      @AccessControl.authorizationCheck: #NOT_REQUIRED
      define root view entity ZI_SalesOrder
        as select from sepm_sddl_so as SalesOrder
        association [0..*] to ZI_SalesOrderItem as _Items
          on $projection.SalesOrderKey = _Items.SalesOrderKey
      {
        key SalesOrder.sales_order_key as SalesOrderKey,
        SalesOrder.created_by as CreatedBy,
        _Items
      }
    `;

    it("should extract CDS view entity accurately", async () => {
      const { functions } = await extractFunctionsWithTreeSitter(
        "zi_sales_order.cds",
        cdsCode,
        "cds",
      );
      expect(functions.length).toBeGreaterThan(0);
      expect(functions[0].name).toBe("ZI_SalesOrder");
    });
  });

  describe("2. SAP ABAP", () => {
    const abapCode = `
      CLASS zcl_order_processor DEFINITION PUBLIC FINAL CREATE PUBLIC.
        PUBLIC SECTION.
          METHODS: process_order IMPORTING iv_order_id TYPE string.
      ENDCLASS.

      CLASS zcl_order_processor IMPLEMENTATION.
        METHOD process_order.
          SELECT * FROM zorders INTO TABLE @DATA(lt_orders) WHERE order_id = @iv_order_id.
        ENDMETHOD.
      ENDCLASS.
    `;

    it("should extract ABAP methods accurately", async () => {
      const { functions } = await extractFunctionsWithTreeSitter(
        "zcl_order.abap",
        abapCode,
        "abap",
      );
      expect(functions.length).toBeGreaterThan(0);
      const names = functions.map((f) => f.name);
      expect(names).toContain("process_order");
    });
  });

  describe("3. Oracle PL/SQL", () => {
    const plsqlCode = `
      CREATE OR REPLACE PACKAGE sales_pkg AS
        FUNCTION calculate_commission(sales_amount NUMBER) RETURN NUMBER;
        PROCEDURE process_batch(batch_id VARCHAR2);
      END sales_pkg;
      /

      CREATE OR REPLACE PACKAGE BODY sales_pkg AS
        FUNCTION calculate_commission(sales_amount NUMBER) RETURN NUMBER IS
        BEGIN
          RETURN sales_amount * 0.10;
        END calculate_commission;

        PROCEDURE process_batch(batch_id VARCHAR2) IS
        BEGIN
          COMMIT;
        END process_batch;
      END sales_pkg;
      /
    `;

    it("should extract PL/SQL package, functions and procedures accurately", async () => {
      const { functions } = await extractFunctionsWithTreeSitter(
        "sales_pkg.sql",
        plsqlCode,
        "plsql",
      );
      expect(functions.length).toBeGreaterThan(0);
      const names = functions.map((f) => f.name);
      expect(names).toContain("sales_pkg");
      expect(names).toContain("calculate_commission");
      expect(names).toContain("process_batch");
    });
  });

  describe("4. TypeScript & JavaScript", () => {
    const tsCode = `
      import { format } from 'date-fns';
      import * as path from 'path';

      export function parseDate(input: string): string {
        return format(new Date(input), 'yyyy-MM-dd');
      }
    `;

    it("should extract TS functions, methods and imports accurately", async () => {
      const { functions } = await extractFunctionsWithTreeSitter(
        "order.ts",
        tsCode,
        "typescript",
      );
      const imports = await extractImportsWithTreeSitter(
        "order.ts",
        tsCode,
        "typescript",
      );
      const calls = await extractCallsWithTreeSitter(
        "order.ts",
        tsCode,
        "typescript",
      );

      expect(functions.map((f) => f.name)).toContain("parseDate");

      const importPaths = imports.imports.map((i) => i.raw);
      expect(importPaths).toContain("date-fns");
      expect(importPaths).toContain("path");

      const called = calls.map((c) => c.calleeName);
      expect(called).toContain("format");
    });
  });

  describe("5. Python", () => {
    const pyCode = `
      import os
      from pathlib import Path

      def process_data(file_path: str) -> None:
        path = Path(file_path)
        print(path.name)

      async def fetch_remote(url: str):
        pass
    `;

    it("should extract Python functions, imports and calls accurately", async () => {
      const { functions } = await extractFunctionsWithTreeSitter(
        "script.py",
        pyCode,
        "python",
      );
      const imports = await extractImportsWithTreeSitter(
        "script.py",
        pyCode,
        "python",
      );
      const calls = await extractCallsWithTreeSitter(
        "script.py",
        pyCode,
        "python",
      );

      expect(functions.map((f) => f.name)).toContain("process_data");
      expect(functions.map((f) => f.name)).toContain("fetch_remote");

      const importPaths = imports.imports.map((i) => i.raw);
      expect(importPaths).toContain("os");
      expect(importPaths).toContain("pathlib");

      const called = calls.map((c) => c.calleeName);
      expect(called).toContain("Path");
      expect(called).toContain("print");
    });
  });
});
