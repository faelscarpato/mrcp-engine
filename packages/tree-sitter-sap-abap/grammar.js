module.exports = grammar({
  name: 'sap_abap',

  extras: $ => [
    /\s/,
    $.comment,
  ],

  conflicts: $ => [
    [$._expression, $.table_expression],
    [$._expression, $.method_call],
    [$.read_table_statement, $._expression],
    [$._expression, $.value_field_assignment],
    [$.parenthesized_expression, $.value_row],
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.report_statement,
      $.program_statement,
      $.class_definition,
      $.class_implementation,
      $.interface_definition,
      $.method_implementation,
      $.data_statement,
      $.types_statement,
      $.constants_statement,
      $.assignment_statement,
      $.call_method_statement,
      $.select_statement,
      $.loop_statement,
      $.read_table_statement,
      $.if_statement,
      $.case_statement,
      $.try_statement,
      $.append_statement,
      $.insert_statement,
      $.modify_statement,
      $.delete_statement,
      $.clear_statement,
      $.write_statement,
      $.return_statement,
      $.raise_statement,
    ),

    comment: $ => token(seq('"', /.*/)),

    identifier: $ => choice(
      /[a-zA-Z_][a-zA-Z0-9_]*/,
      seq('/', /[a-zA-Z0-9_]+/, '/', /[a-zA-Z0-9_]+/)
    ),

    field_symbol: $ => seq('<', /[a-zA-Z0-9_]+/, '>'),

    string_literal: $ => choice(
      /'[^']*'/,
      /`[^`]*`/,
      seq('|', /[^|]*/, '|')
    ),

    number: $ => /\d+(\.\d+)?/,

    report_statement: $ => seq(kw('report'), field('name', $.identifier), '.'),
    program_statement: $ => seq(kw('program'), field('name', $.identifier), '.'),

    // ==========================================
    // ABAP OO: CLASS DEFINITION & SECTIONS
    // ==========================================
    class_definition: $ => seq(
      kw('class'),
      field('name', $.identifier),
      kw('definition'),
      repeat(choice(
        kw('public'),
        kw('final'),
        kw('abstract'),
        seq(kw('create'), choice(kw('public'), kw('protected'), kw('private'))),
        seq(kw('inheriting'), kw('from'), field('superclass', $.identifier)),
        kw('for testing'),
        kw('risk level harmless'),
        kw('risk level dangerous'),
        kw('duration short'),
        kw('duration medium'),
        kw('duration long')
      )),
      '.',
      repeat($._class_section),
      kw('endclass'),
      '.'
    ),

    _class_section: $ => choice(
      $.public_section,
      $.protected_section,
      $.private_section,
    ),

    public_section: $ => seq(kw('public'), kw('section'), '.', repeat($._section_statement)),
    protected_section: $ => seq(kw('protected'), kw('section'), '.', repeat($._section_statement)),
    private_section: $ => seq(kw('private'), kw('section'), '.', repeat($._section_statement)),

    _section_statement: $ => choice(
      $.method_definition_statement,
      $.data_statement,
      $.types_statement,
      $.constants_statement,
      $.interfaces_statement,
      $.aliases_statement,
    ),

    interfaces_statement: $ => seq(kw('interfaces'), optional(':'), sepBy1(',', field('name', $.identifier)), '.'),
    aliases_statement: $ => seq(kw('aliases'), field('alias', $.identifier), kw('for'), field('component', $.identifier), '.'),

    method_definition_statement: $ => seq(
      choice(kw('methods'), kw('class-methods')),
      optional(':'),
      sepBy1(',', $.method_definition_item),
      '.'
    ),

    method_definition_item: $ => seq(
      field('name', $.identifier),
      repeat(choice(
        seq(kw('importing'), repeat1($.method_parameter)),
        seq(kw('exporting'), repeat1($.method_parameter)),
        seq(kw('changing'), repeat1($.method_parameter)),
        seq(kw('returning'), kw('value'), '(', field('return_name', $.identifier), ')', optional(seq(kw('type'), field('return_type', $._type_reference)))),
        seq(kw('raising'), repeat1($.identifier)),
        kw('for testing')
      ))
    ),

    method_parameter: $ => seq(
      choice(
        seq(choice(kw('value'), kw('reference')), '(', field('name', $.identifier), ')'),
        field('name', $.identifier)
      ),
      optional(seq(choice(kw('type'), kw('type ref to'), kw('like')), field('type', $._type_reference))),
      optional(kw('optional')),
      optional(seq(kw('default'), field('default', $._expression)))
    ),

    // ==========================================
    // ABAP OO: CLASS IMPLEMENTATION & METHODS
    // ==========================================
    class_implementation: $ => seq(
      kw('class'),
      field('name', $.identifier),
      kw('implementation'),
      '.',
      repeat($.method_implementation),
      kw('endclass'),
      '.'
    ),

    method_implementation: $ => seq(
      kw('method'),
      field('name', $.identifier),
      '.',
      repeat($._statement),
      kw('endmethod'),
      '.'
    ),

    interface_definition: $ => seq(
      kw('interface'),
      field('name', $.identifier),
      optional(kw('public')),
      '.',
      repeat($._section_statement),
      kw('endinterface'),
      '.'
    ),

    // ==========================================
    // DATA, TYPES & CONSTANTS
    // ==========================================
    data_statement: $ => choice(
      seq(kw('data'), optional(':'), sepBy1(',', $.data_item), '.'),
      seq(kw('data'), '(', field('name', $.identifier), ')', '=', field('value', $._expression), '.')
    ),

    types_statement: $ => seq(kw('types'), optional(':'), sepBy1(',', $.type_item), '.'),
    constants_statement: $ => seq(kw('constants'), optional(':'), sepBy1(',', $.data_item), '.'),

    data_item: $ => seq(
      field('name', choice($.identifier, $.field_symbol)),
      optional(seq(
        choice(kw('type'), kw('type ref to'), kw('type table of'), kw('type standard table of'), kw('type sorted table of'), kw('type hashed table of'), kw('like'), kw('like table of')),
        field('type', $._type_reference)
      )),
      optional(seq(kw('decimals'), $.number)),
      optional(kw('with default key')),
      optional(kw('with empty key')),
      optional(seq(kw('with unique key'), repeat1($.identifier))),
      optional(seq(kw('with non-unique key'), repeat1($.identifier))),
      optional(seq(kw('value'), field('value', $._expression))),
      optional(kw('read-only'))
    ),

    type_item: $ => seq(
      field('name', $.identifier),
      optional(seq(
        choice(kw('type'), kw('type ref to'), kw('type table of'), kw('type standard table of'), kw('type sorted table of'), kw('type hashed table of'), kw('like')),
        field('type', $._type_reference)
      )),
      optional(seq(kw('decimals'), $.number)),
      optional(kw('with default key')),
      optional(kw('with empty key'))
    ),

    _type_reference: $ => choice(
      $.identifier,
      seq($.identifier, '=>', $.identifier),
      seq($.identifier, '->', $.identifier),
      seq(choice(kw('table of'), kw('standard table of'), kw('sorted table of'), kw('hashed table of')), $.identifier),
    ),

    // ==========================================
    // STATEMENTS: ASSIGNMENT, CALL, SQL, LOOPS
    // ==========================================
    assignment_statement: $ => seq(
      field('target', choice($._variable, $.field_symbol, $.identifier)),
      '=',
      field('value', $._expression),
      '.'
    ),

    call_method_statement: $ => choice(
      seq(kw('call'), kw('method'), field('call', $.method_call), '.'),
      seq(field('call', $.method_call), '.')
    ),

    select_statement: $ => seq(
      kw('select'),
      optional(kw('single')),
      choice(
        // Classic: SELECT ... FROM table ...
        seq(
          field('fields', $._select_fields),
          kw('from'),
          field('data_source', $.identifier),
          optional(seq(kw('as'), field('alias', $.identifier))),
          repeat($.join_clause),
          optional(seq(kw('where'), field('where_clause', $._expression))),
          optional(seq(
            choice(kw('into table'), kw('into corresponding fields of table'), kw('into'), kw('into corresponding fields of')),
            field('target', choice($.host_variable, $._variable, $.field_symbol, $.identifier))
          )),
          optional(seq(kw('up to'), field('rows', $.number), kw('rows')))
        ),
        // Modern 7.40+: SELECT FROM table FIELDS ...
        seq(
          kw('from'),
          field('data_source', $.identifier),
          optional(seq(kw('as'), field('alias', $.identifier))),
          repeat($.join_clause),
          kw('fields'),
          field('fields', $._select_fields),
          optional(seq(kw('where'), field('where_clause', $._expression))),
          optional(seq(
            choice(kw('into table'), kw('into corresponding fields of table'), kw('into'), kw('into corresponding fields of')),
            field('target', choice($.host_variable, $._variable, $.field_symbol, $.identifier))
          )),
          optional(seq(kw('up to'), field('rows', $.number), kw('rows')))
        )
      ),
      '.'
    ),

    host_variable: $ => seq(
      '@',
      choice(
        seq(kw('data'), '(', field('name', $.identifier), ')'),
        $._variable,
        $.field_symbol,
        $.identifier
      )
    ),

    _select_fields: $ => choice(
      '*',
      sepBy1(',', choice($.identifier, seq($.identifier, '~', $.identifier), seq(kw('count'), '(', choice('*', $.identifier), ')'), seq(kw('sum'), '(', $.identifier, ')'), seq(kw('avg'), '(', $.identifier, ')'), seq(kw('min'), '(', $.identifier, ')'), seq(kw('max'), '(', $.identifier, ')')))
    ),

    join_clause: $ => seq(
      choice(
        kw('inner join'),
        kw('left outer join'),
        kw('right outer join'),
        kw('join')
      ),
      field('target', $.identifier),
      optional(seq(kw('as'), field('alias', $.identifier))),
      kw('on'),
      field('condition', $._expression)
    ),

    loop_statement: $ => seq(
      kw('loop'), kw('at'), field('source', choice($.identifier, $._variable)),
      optional(choice(
        seq(kw('into'), field('target', choice(seq(kw('data'), '(', $.identifier, ')'), $._variable, $.identifier))),
        seq(kw('assigning'), choice(seq(kw('field-symbol'), '(', field('target', $.field_symbol), ')'), field('target', $.field_symbol))),
        seq(kw('transporting no fields'))
      )),
      optional(seq(kw('where'), field('where_clause', $._expression))),
      '.',
      repeat($._statement),
      kw('endloop'),
      '.'
    ),

    read_table_statement: $ => seq(
      kw('read'), kw('table'), field('source', choice($.identifier, $._variable)),
      optional(choice(
        seq(kw('into'), field('target', choice(seq(kw('data'), '(', $.identifier, ')'), $._variable, $.identifier))),
        seq(kw('assigning'), choice(seq(kw('field-symbol'), '(', field('target', $.field_symbol), ')'), field('target', $.field_symbol))),
        kw('transporting no fields')
      )),
      optional(seq(choice(kw('with key'), kw('with table key')), repeat1(choice(seq(field('key', $.identifier), '=', field('val', $._expression)), $._expression)))),
      optional(kw('binary search')),
      '.'
    ),

    if_statement: $ => seq(
      kw('if'), field('condition', $._expression), '.',
      repeat($._statement),
      repeat($.elseif_clause),
      optional($.else_clause),
      kw('endif'),
      '.'
    ),

    elseif_clause: $ => seq(kw('elseif'), field('condition', $._expression), '.', repeat($._statement)),
    else_clause: $ => seq(kw('else'), '.', repeat($._statement)),

    case_statement: $ => seq(
      kw('case'), field('value', $._expression), '.',
      repeat($.when_statement_clause),
      optional($.when_others_clause),
      kw('endcase'),
      '.'
    ),

    when_statement_clause: $ => seq(kw('when'), sepBy1(choice(',', kw('or')), $._expression), '.', repeat($._statement)),
    when_others_clause: $ => seq(kw('when others'), '.', repeat($._statement)),

    try_statement: $ => seq(
      kw('try'), '.',
      repeat($._statement),
      repeat($.catch_clause),
      optional($.cleanup_clause),
      kw('endtry'),
      '.'
    ),

    catch_clause: $ => seq(
      kw('catch'),
      repeat1(field('exception', $.identifier)),
      optional(seq(kw('into'), field('target', choice(seq(kw('data'), '(', $.identifier, ')'), $._variable, $.identifier)))),
      '.',
      repeat($._statement)
    ),

    cleanup_clause: $ => seq(kw('cleanup'), '.', repeat($._statement)),

    append_statement: $ => seq(
      kw('append'),
      field('source', choice(kw('initial line'), $._expression)),
      optional(seq(kw('to'), field('target', choice($.identifier, $._variable)))),
      optional(seq(kw('assigning'), field('target', $.field_symbol))),
      '.'
    ),

    insert_statement: $ => seq(
      kw('insert'),
      field('source', choice(kw('initial line into'), $._expression)),
      optional(kw('into')),
      optional(kw('table')),
      field('target', choice($.identifier, $._variable)),
      optional(seq(kw('assigning'), field('target', $.field_symbol))),
      '.'
    ),

    modify_statement: $ => seq(
      kw('modify'),
      choice(
        seq(field('target', choice($.identifier, $._variable)), optional(seq(kw('from'), field('source', $._expression)))),
        seq(kw('table'), field('target', choice($.identifier, $._variable)), optional(seq(kw('from'), field('source', $._expression))))
      ),
      '.'
    ),

    delete_statement: $ => seq(
      kw('delete'),
      choice(
        seq(field('target', choice($.identifier, $._variable)), optional(seq(kw('where'), field('where_clause', $._expression)))),
        seq(kw('table'), field('target', choice($.identifier, $._variable)), optional(seq(kw('from'), field('source', $._expression))))
      ),
      '.'
    ),

    clear_statement: $ => seq(choice(kw('clear'), kw('free'), kw('refresh')), field('target', choice($.identifier, $._variable, $.field_symbol)), '.'),
    write_statement: $ => seq(kw('write'), optional(':'), sepBy1(',', choice(seq(optional('/'), $._expression), '/')), '.'),
    return_statement: $ => seq(choice(kw('return'), kw('exit'), kw('continue'), kw('leave to screen 0'), kw('check'), seq(kw('check'), $._expression)), '.'),
    raise_statement: $ => seq(
      kw('raise'),
      optional(kw('exception')),
      choice(
        seq(
          choice(kw('type'), kw('new')),
          field('type', $.identifier),
          optional(seq(kw('exporting'), repeat1(seq(field('param', $.identifier), '=', field('val', $._expression)))))
        ),
        field('name', $.identifier)
      ),
      '.'
    ),

    // ==========================================
    // EXPRESSIONS & 7.40+ MODERN SYNTAX
    // ==========================================
    _expression: $ => choice(
      $.identifier,
      $.field_symbol,
      $.string_literal,
      $.number,
      $._variable,
      $.method_call,
      $.value_expression,
      $.corresponding_expression,
      $.cond_expression,
      $.switch_expression,
      $.reduce_expression,
      $.table_expression,
      $.predicate_expression,
      $.binary_expression,
      $.unary_expression,
      $.parenthesized_expression,
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    _variable: $ => prec.left(2, choice(
      seq(choice($.identifier, $.field_symbol), token.immediate('-'), $.identifier),
      seq(choice($.identifier, $.field_symbol), '->', $.identifier),
      seq(choice($.identifier, $.field_symbol), '=>', $.identifier),
    )),

    method_call: $ => prec.left(3, seq(
      field('caller', choice($.identifier, $._variable, $.field_symbol)),
      choice('->', '=>'),
      field('method', $.identifier),
      '(',
      optional(choice(
        sepBy(',', $._expression),
        repeat1(seq(field('param', $.identifier), '=', field('val', $._expression)))
      )),
      ')'
    )),

    value_expression: $ => prec(2, seq(
      kw('value'),
      choice($.identifier, '#'),
      '(',
      repeat(choice(
        $.value_row,
        $.value_field_assignment,
        $._expression
      )),
      ')'
    )),

    value_row: $ => seq('(', repeat(choice($.value_field_assignment, $._expression)), ')'),
    value_field_assignment: $ => seq(field('field', $.identifier), '=', field('val', $._expression)),

    corresponding_expression: $ => seq(
      kw('corresponding'),
      choice($.identifier, '#'),
      '(',
      field('source', $._expression),
      optional(seq(kw('mapping'), repeat1(seq($.identifier, '=', $.identifier)))),
      ')'
    ),

    cond_expression: $ => seq(
      kw('cond'),
      choice($.identifier, '#'),
      '(',
      repeat1(seq(kw('when'), field('condition', $._expression), kw('then'), field('result', $._expression))),
      optional(seq(kw('else'), field('default', $._expression))),
      ')'
    ),

    switch_expression: $ => seq(
      kw('switch'),
      choice($.identifier, '#'),
      '(',
      field('value', $._expression),
      repeat1(seq(kw('when'), field('condition', $._expression), kw('then'), field('result', $._expression))),
      optional(seq(kw('else'), field('default', $._expression))),
      ')'
    ),

    reduce_expression: $ => seq(
      kw('reduce'),
      choice($.identifier, '#'),
      '(',
      kw('init'), field('init_var', $.identifier), '=', field('init_val', $._expression),
      kw('for'), field('for_item', $.identifier), kw('in'), field('for_source', $._expression),
      kw('next'), field('next_var', $.identifier), '=', field('next_val', $._expression),
      ')'
    ),

    table_expression: $ => prec(3, seq(
      field('table', choice($.identifier, $._variable)),
      '[',
      repeat1(choice(
        seq(field('key', $.identifier), '=', field('val', $._expression)),
        $._expression
      )),
      ']'
    )),

    unary_expression: $ => prec(4, seq(
      choice(kw('not'), '-', '+'),
      $._expression
    )),

    predicate_expression: $ => prec(2, seq(
      field('expression', $._expression),
      choice(
        kw('is initial'),
        kw('is not initial'),
        kw('is bound'),
        kw('is not bound'),
        kw('is assigned'),
        kw('is not assigned')
      )
    )),

    binary_expression: $ => prec.left(1, seq(
      field('left', $._expression),
      field('operator', choice(
        '=', '<>', '><', '!=', '<', '<=', '>', '>=',
        kw('eq'), kw('ne'), kw('lt'), kw('le'), kw('gt'), kw('ge'),
        kw('and'), kw('or'),
        kw('like'), kw('in'), kw('between'),
        '+', '-', '*', '/', kw('div'), kw('mod'), '&&'
      )),
      field('right', $._expression)
    )),
  }
});

function kw(keyword) {
  return token(prec(1, new RegExp(
    keyword
      .split('')
      .map(letter => letter === ' ' ? '\\s+' : letter === '-' ? '\\-' : `[${letter.toLowerCase()}${letter.toUpperCase()}]`)
      .join('')
  )));
}

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
