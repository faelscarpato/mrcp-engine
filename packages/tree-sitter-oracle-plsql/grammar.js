function kw(keyword) {
  const words = keyword.split(' ');
  const regExps = words.map(createCaseInsensitiveRegex);

  return regExps.length === 1
    ? alias(token(prec(2, regExps[0])), keyword)
    : alias(token(prec(2, seq(...regExps))), keyword.replace(/ /g, '_'));
}

function createCaseInsensitiveRegex(word) {
  return new RegExp(
    word
      .split('')
      .map(letter => letter === '-' ? '\\-' : `[${letter.toLowerCase()}${letter.toUpperCase()}]`)
      .join('')
  );
}

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}

module.exports = grammar({
  name: 'oracle_plsql',

  extras: $ => [
    /\s/,
    $.comment,
  ],

  conflicts: $ => [
    [$.qualified_identifier, $.procedure_signature],
    [$.qualified_identifier, $.function_signature],
    [$._expression, $.method_call],
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.package_definition,
      $.package_body_definition,
      $.procedure_definition,
      $.function_definition,
      $.trigger_definition,
      $.anonymous_block,
      $.variable_declaration,
      $.cursor_declaration,
      $.type_declaration,
      $.assignment_statement,
      $.call_statement,
      $.select_statement,
      $.insert_statement,
      $.update_statement,
      $.delete_statement,
      $.cursor_open_statement,
      $.cursor_fetch_statement,
      $.cursor_close_statement,
      $.if_statement,
      $.case_statement,
      $.loop_statement,
      $.while_statement,
      $.for_loop_statement,
      $.forall_statement,
      $.commit_statement,
      $.rollback_statement,
      $.savepoint_statement,
      $.raise_statement,
      $.return_statement,
      $.null_statement,
    ),

    comment: $ => token(choice(
      seq('--', /.*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')
    )),

    identifier: $ => choice(
      /[a-zA-Z_][a-zA-Z0-9_$#]*/,
      seq('"', /[^"]*/, '"')
    ),

    qualified_identifier: $ => sepBy1('.', $.identifier),
    bind_variable: $ => seq(':', choice($.identifier, seq(choice(kw('NEW'), kw('OLD')), '.', $.identifier))),
    string_literal: $ => /'[^']*'/,
    number: $ => /\d+(\.\d+)?([eE][+-]?\d+)?/,

    // ==========================================
    // PACKAGES
    // ==========================================
    package_definition: $ => seq(
      optional(seq(kw('CREATE'), optional(seq(kw('OR'), kw('REPLACE'))))),
      kw('PACKAGE'),
      field('name', $.qualified_identifier),
      choice(kw('IS'), kw('AS')),
      repeat(choice(
        $.procedure_signature,
        $.function_signature,
        $.variable_declaration,
        $.cursor_declaration,
        $.type_declaration,
        $.exception_declaration,
        $.pragma_statement,
      )),
      kw('END'),
      optional(field('end_name', $.identifier)),
      ';'
    ),

    package_body_definition: $ => seq(
      optional(seq(kw('CREATE'), optional(seq(kw('OR'), kw('REPLACE'))))),
      kw('PACKAGE'),
      kw('BODY'),
      field('name', $.qualified_identifier),
      choice(kw('IS'), kw('AS')),
      repeat(choice(
        $.procedure_definition,
        $.function_definition,
        $.procedure_signature,
        $.function_signature,
        $.variable_declaration,
        $.cursor_declaration,
        $.type_declaration,
        $.exception_declaration,
        $.pragma_statement,
      )),
      kw('END'),
      optional(field('end_name', $.identifier)),
      ';'
    ),

    procedure_signature: $ => seq(
      kw('PROCEDURE'),
      field('name', $.qualified_identifier),
      optional(field('parameters', $.parameter_list)),
      ';'
    ),

    function_signature: $ => seq(
      kw('FUNCTION'),
      field('name', $.qualified_identifier),
      optional(field('parameters', $.parameter_list)),
      kw('RETURN'),
      field('return_type', $._type_spec),
      ';'
    ),

    // ==========================================
    // PROCEDURES & FUNCTIONS
    // ==========================================
    procedure_definition: $ => seq(
      optional(seq(kw('CREATE'), optional(seq(kw('OR'), kw('REPLACE'))))),
      kw('PROCEDURE'),
      field('name', $.qualified_identifier),
      optional(field('parameters', $.parameter_list)),
      choice(kw('IS'), kw('AS')),
      repeat($._declaration),
      kw('BEGIN'),
      repeat($._statement),
      optional($.exception_block),
      kw('END'),
      optional(field('end_name', $.identifier)),
      ';'
    ),

    function_definition: $ => seq(
      optional(seq(kw('CREATE'), optional(seq(kw('OR'), kw('REPLACE'))))),
      kw('FUNCTION'),
      field('name', $.qualified_identifier),
      optional(field('parameters', $.parameter_list)),
      kw('RETURN'),
      field('return_type', $._type_spec),
      choice(kw('IS'), kw('AS')),
      repeat($._declaration),
      kw('BEGIN'),
      repeat($._statement),
      optional($.exception_block),
      kw('END'),
      optional(field('end_name', $.identifier)),
      ';'
    ),

    // ==========================================
    // TRIGGERS & BLOCKS
    // ==========================================
    trigger_definition: $ => seq(
      optional(seq(kw('CREATE'), optional(seq(kw('OR'), kw('REPLACE'))))),
      kw('TRIGGER'),
      field('name', $.qualified_identifier),
      choice(kw('BEFORE'), kw('AFTER'), seq(kw('INSTEAD'), kw('OF'))),
      sepBy1(kw('OR'), choice(kw('INSERT'), kw('UPDATE'), kw('DELETE'))),
      kw('ON'),
      field('table', $.qualified_identifier),
      optional(seq(kw('FOR'), kw('EACH'), kw('ROW'))),
      optional(seq(kw('DECLARE'), repeat($._declaration))),
      kw('BEGIN'),
      repeat($._statement),
      optional($.exception_block),
      kw('END'),
      optional(field('end_name', $.identifier)),
      ';'
    ),

    anonymous_block: $ => seq(
      optional(seq(kw('DECLARE'), repeat($._declaration))),
      kw('BEGIN'),
      repeat($._statement),
      optional($.exception_block),
      kw('END'),
      ';'
    ),

    _declaration: $ => choice(
      $.variable_declaration,
      $.cursor_declaration,
      $.type_declaration,
      $.exception_declaration,
      $.pragma_statement,
    ),

    parameter_list: $ => seq('(', sepBy1(',', $.parameter), ')'),

    parameter: $ => seq(
      field('name', $.identifier),
      optional(choice(seq(kw('IN'), kw('OUT')), kw('IN'), kw('OUT'))),
      field('type', $._type_spec),
    ),

    _type_spec: $ => choice(
      seq($.qualified_identifier, choice(kw('%TYPE'), kw('%ROWTYPE'))),
      seq($.qualified_identifier, optional(seq('(', $.number, ')'))),
      kw('BOOLEAN'), kw('NUMBER'), kw('VARCHAR2'), kw('CLOB'), kw('BLOB'), kw('DATE'), kw('TIMESTAMP'), kw('PLS_INTEGER'),
    ),

    variable_declaration: $ => seq(
      field('name', $.identifier),
      field('type', $._type_spec),
      optional(seq(':=', field('value', $._expression))),
      ';'
    ),

    cursor_declaration: $ => seq(
      kw('CURSOR'),
      field('name', $.identifier),
      optional(field('parameters', $.parameter_list)),
      kw('IS'),
      field('query', $.select_query),
      ';'
    ),

    type_declaration: $ => seq(
      kw('TYPE'),
      field('name', $.identifier),
      kw('IS'),
      choice(
        seq(kw('RECORD'), '(', sepBy1(',', seq(field('field_name', $.identifier), field('field_type', $._type_spec))), ')'),
        seq(choice(kw('TABLE'), kw('VARRAY')), optional(seq('(', $.number, ')')), kw('OF'), field('element_type', $._type_spec)),
        seq(kw('REF'), kw('CURSOR'))
      ),
      ';'
    ),

    exception_declaration: $ => seq(
      field('name', $.identifier),
      kw('EXCEPTION'),
      ';'
    ),

    pragma_statement: $ => seq(
      kw('PRAGMA'),
      choice(
        seq(kw('EXCEPTION_INIT'), '(', $.identifier, ',', choice($.number, seq('-', $.number)), ')'),
        kw('AUTONOMOUS_TRANSACTION')
      ),
      ';'
    ),

    // ==========================================
    // STATEMENTS
    // ==========================================
    assignment_statement: $ => seq(
      field('target', choice($.qualified_identifier, $.bind_variable)),
      ':=',
      field('value', $._expression),
      ';'
    ),

    call_statement: $ => seq(field('call', $.method_call), ';'),
    null_statement: $ => seq(kw('NULL'), ';'),

    select_statement: $ => seq($.select_query, ';'),

    select_query: $ => seq(
      kw('SELECT'),
      optional(choice(kw('DISTINCT'), kw('ALL'))),
      field('fields', choice('*', sepBy1(',', choice($.qualified_identifier, $.method_call)))),
      optional(seq(choice(kw('INTO'), seq(kw('BULK'), kw('COLLECT'), kw('INTO'))), field('into', sepBy1(',', choice($.qualified_identifier, $.bind_variable))))),
      kw('FROM'),
      field('from', sepBy1(',', $.qualified_identifier)),
      repeat($.join_clause),
      optional(seq(kw('WHERE'), field('where', $._expression))),
      optional(seq(kw('GROUP'), kw('BY'), sepBy1(',', $.qualified_identifier))),
      optional(seq(kw('ORDER'), kw('BY'), sepBy1(',', $.qualified_identifier))),
      optional(seq(kw('FOR'), kw('UPDATE'))),
    ),

    join_clause: $ => seq(
      choice(
        seq(kw('INNER'), kw('JOIN')),
        seq(optional(choice(kw('LEFT'), kw('RIGHT'), kw('FULL'))), optional(kw('OUTER')), kw('JOIN')),
        seq(kw('CROSS'), kw('JOIN'))
      ),
      field('table', $.qualified_identifier),
      optional(seq(kw('ON'), field('condition', $._expression)))
    ),

    insert_statement: $ => seq(
      kw('INSERT'), kw('INTO'),
      field('table', $.qualified_identifier),
      optional(seq('(', sepBy1(',', $.identifier), ')')),
      choice(
        seq(kw('VALUES'), '(', sepBy1(',', $._expression), ')'),
        $.select_query
      ),
      ';'
    ),

    update_statement: $ => seq(
      kw('UPDATE'),
      field('table', $.qualified_identifier),
      kw('SET'),
      sepBy1(',', seq(field('column', $.qualified_identifier), '=', field('value', $._expression))),
      optional(seq(kw('WHERE'), field('where', $._expression))),
      ';'
    ),

    delete_statement: $ => seq(
      kw('DELETE'), optional(kw('FROM')),
      field('table', $.qualified_identifier),
      optional(seq(kw('WHERE'), field('where', $._expression))),
      ';'
    ),

    cursor_open_statement: $ => seq(kw('OPEN'), field('cursor', $.identifier), optional(seq('(', sepBy1(',', $._expression), ')')), ';'),
    cursor_fetch_statement: $ => seq(kw('FETCH'), field('cursor', $.identifier), choice(kw('INTO'), seq(kw('BULK'), kw('COLLECT'), kw('INTO'))), sepBy1(',', choice($.qualified_identifier, $.bind_variable)), ';'),
    cursor_close_statement: $ => seq(kw('CLOSE'), field('cursor', $.identifier), ';'),

    if_statement: $ => seq(
      kw('IF'), field('condition', $._expression), kw('THEN'),
      repeat($._statement),
      repeat($.elsif_clause),
      optional($.else_clause),
      kw('END'), kw('IF'), ';'
    ),

    elsif_clause: $ => seq(kw('ELSIF'), field('condition', $._expression), kw('THEN'), repeat($._statement)),
    else_clause: $ => seq(kw('ELSE'), repeat($._statement)),

    case_statement: $ => seq(
      kw('CASE'), optional(field('expression', $._expression)),
      repeat1(seq(kw('WHEN'), field('condition', $._expression), kw('THEN'), repeat($._statement))),
      optional(seq(kw('ELSE'), repeat($._statement))),
      kw('END'), kw('CASE'), ';'
    ),

    loop_statement: $ => seq(kw('LOOP'), repeat($._statement), kw('END'), kw('LOOP'), ';'),
    while_statement: $ => seq(kw('WHILE'), field('condition', $._expression), kw('LOOP'), repeat($._statement), kw('END'), kw('LOOP'), ';'),
    for_loop_statement: $ => seq(kw('FOR'), field('iterator', $.identifier), kw('IN'), choice(seq(field('low', $._expression), '..', field('high', $._expression)), field('cursor', $.qualified_identifier)), kw('LOOP'), repeat($._statement), kw('END'), kw('LOOP'), ';'),
    forall_statement: $ => seq(kw('FORALL'), field('iterator', $.identifier), kw('IN'), field('low', $._expression), '..', field('high', $._expression), choice($.insert_statement, $.update_statement, $.delete_statement)),

    commit_statement: $ => seq(kw('COMMIT'), ';'),
    rollback_statement: $ => seq(kw('ROLLBACK'), optional(seq(kw('TO'), optional(kw('SAVEPOINT')), $.identifier)), ';'),
    savepoint_statement: $ => seq(kw('SAVEPOINT'), $.identifier, ';'),
    raise_statement: $ => seq(kw('RAISE'), optional(field('exception', $.qualified_identifier)), ';'),
    return_statement: $ => seq(kw('RETURN'), optional(field('value', $._expression)), ';'),

    exception_block: $ => seq(
      kw('EXCEPTION'),
      repeat1($.exception_handler)
    ),

    exception_handler: $ => seq(
      kw('WHEN'),
      sepBy1(kw('OR'), choice($.qualified_identifier, kw('OTHERS'))),
      kw('THEN'),
      repeat($._statement)
    ),

    // ==========================================
    // EXPRESSIONS
    // ==========================================
    _expression: $ => choice(
      $.qualified_identifier,
      $.bind_variable,
      $.string_literal,
      $.number,
      $.method_call,
      $.binary_expression,
      $.unary_expression,
      $.parenthesized_expression,
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    method_call: $ => prec(2, seq(
      field('function', $.qualified_identifier),
      '(',
      optional(sepBy(',', choice(
        $._expression,
        seq(field('param', $.identifier), '=>', field('val', $._expression))
      ))),
      ')'
    )),

    unary_expression: $ => prec(3, seq(
      choice(kw('NOT'), '-', '+'),
      $._expression
    )),

    binary_expression: $ => prec.left(1, seq(
      field('left', $._expression),
      field('operator', choice(
        kw('OR'), kw('AND'),
        '=', '!=', '<>', '<', '<=', '>', '>=',
        kw('LIKE'), kw('IN'),
        '||', '+', '-', '*', '/'
      )),
      field('right', $._expression)
    )),
  }
});
