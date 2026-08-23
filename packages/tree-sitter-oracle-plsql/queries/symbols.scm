; Package definitions
(package_definition
  name: (qualified_identifier) @name.definition.package) @definition.package

(package_body_definition
  name: (qualified_identifier) @name.definition.package_body) @definition.package_body

; Procedures and Functions
(procedure_definition
  name: (qualified_identifier) @name.definition.procedure) @definition.procedure

(procedure_signature
  name: (qualified_identifier) @name.definition.procedure_spec) @definition.procedure_spec

(function_definition
  name: (qualified_identifier) @name.definition.function) @definition.function

(function_signature
  name: (qualified_identifier) @name.definition.function_spec) @definition.function_spec

; Triggers
(trigger_definition
  name: (qualified_identifier) @name.definition.trigger
  table: (qualified_identifier) @dependency.trigger_table) @definition.trigger

; Cursors
(cursor_declaration
  name: (identifier) @name.definition.cursor) @definition.cursor

; Table dependencies in SQL
(select_query
  from: (qualified_identifier) @dependency.table)

(insert_statement
  table: (qualified_identifier) @dependency.table)

(update_statement
  table: (qualified_identifier) @dependency.table)

(delete_statement
  table: (qualified_identifier) @dependency.table)

; Join dependencies
(join_clause
  table: (qualified_identifier) @dependency.join_table)

; Method calls for Call Graph
(method_call
  function: (qualified_identifier) @call.method)
