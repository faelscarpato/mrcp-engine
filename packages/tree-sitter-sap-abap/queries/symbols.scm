;; ====================================================================
;; MRCP-Engine: Extração de Símbolos, Linhagem e Dependências SAP ABAP
;; ====================================================================

;; Definição e Implementação de Classes OO
(class_definition
  name: (identifier) @name.definition.class
  superclass: (identifier)? @dependency.class.superclass) @definition.class

(class_implementation
  name: (identifier) @name.implementation.class) @implementation.class

;; Definição de Interfaces
(interface_definition
  name: (identifier) @name.definition.interface) @definition.interface

;; Declaração de Métodos em Seções OO
(method_definition_item
  name: (identifier) @name.definition.method
  return_name: (identifier)? @name.definition.parameter.return
  return_type: (_)? @type.return) @definition.method

;; Implementação de Métodos
(method_implementation
  name: (identifier) @name.implementation.method) @implementation.method

;; Declarações de Variáveis e Estruturas
(data_statement
  (data_item
    name: (_) @name.definition.variable
    type: (_)? @type)) @definition.variable

(data_statement
  name: (identifier) @name.definition.variable) @definition.variable.inline

;; Linhagem de Dados e Consultas SQL / Consumo de CDS Views
(select_statement
  data_source: (identifier) @dependency.table) @query.select

(join_clause
  target: (identifier) @dependency.table.join) @query.join

;; Chamadas de Métodos (Call Graph)
(method_call
  caller: (_) @call.target.receiver
  method: (identifier) @name.call.method) @call.method
