import { describe, it, expect } from "vitest";
import { parsePrismaSchema, parseSqlDdl } from "./sql-parsers.js";

describe("MRCP SQL & Prisma Schema Parser Suite", () => {
  it("should parse Prisma schema models and types", () => {
    const prisma = `
      model User {
        id        Int      @id @default(autoincrement())
        email     String   @unique
        name      String?
        posts     Post[]
      }
    `;
    const tables = parsePrismaSchema(prisma, "schema.prisma");
    expect(tables.length).toBe(1);
    expect(tables[0].tableName).toBe("User");
    expect(
      tables[0].columns.some((c) => c.name === "id" && c.type === "number"),
    ).toBe(true);
    expect(
      tables[0].columns.some((c) => c.name === "email" && c.type === "string"),
    ).toBe(true);
  });

  it("should parse SQL DDL create table statements", () => {
    const ddl = `
      CREATE TABLE orders (
        order_id INT PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2)
      );
    `;
    const tables = parseSqlDdl(ddl, "schema.sql");
    expect(tables.length).toBe(1);
    expect(tables[0].tableName).toBe("orders");
    expect(
      tables[0].columns.some((c) => c.name === "order_id" && c.isPrimaryKey),
    ).toBe(true);
    expect(
      tables[0].columns.some((c) => c.name === "amount" && c.type === "number"),
    ).toBe(true);
  });
});
