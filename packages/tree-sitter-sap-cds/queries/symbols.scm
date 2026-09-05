;; Extração de Entidades e Tabelas Origem
(view_entity_definition
  name: (identifier) @name.definition.entity
  data_source: (data_source name: (_) @dependency.table)
  select_list: (select_list) @body) @definition.entity

(view_definition
  name: (identifier) @name.definition.view
  data_source: (data_source name: (_) @dependency.table)
  select_list: (select_list) @body) @definition.view

;; Associações (Relacionamentos entre entidades)
(association_clause
  target: (identifier) @dependency.association.target
  alias: (identifier) @name.definition.association) @definition.association

;; Campos e Aliases
(select_element
  alias: (identifier)? @name.definition.field
  expression: (_)? @field.expression) @definition.field

;; Parâmetros de Entrada da View
(parameter
  name: (identifier) @name.definition.parameter
  type: (_) @type) @definition.parameter

;; Anotações Semânticas (Segurança, UI, Agregações)
(annotation
  name: (qualified_identifier) @annotation.key
  value: (_)? @annotation.value) @annotation
