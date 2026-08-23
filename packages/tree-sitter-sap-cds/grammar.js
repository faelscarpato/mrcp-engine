module.exports = grammar({
  name: 'sap_cds',

  extras: $ => [
    /\s/,
    $.comment,
  ],

  conflicts: $ => [
    [$.annotation_statement, $.view_entity_definition],
    [$.annotation_statement, $.view_definition],
  ],

  rules: {
    source_file: $ => repeat($._definition),

    _definition: $ => choice(
      $.view_entity_definition,
      $.view_definition,
      $.annotation_statement,
    ),

    comment: $ => token(choice(
      seq('//', /.*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')
    )),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    qualified_identifier: $ => sepBy1('.', $.identifier),
    enum_identifier: $ => seq('#', $.identifier),
    projection_reference: $ => seq('$projection', '.', $.identifier),

    // Anotações: @Namespace.property: value
    annotation: $ => seq(
      '@',
      field('name', $.qualified_identifier),
      optional(seq(':', field('value', $._annotation_value)))
    ),

    annotation_statement: $ => prec(-1, seq($.annotation, optional(';'))),

    _annotation_value: $ => choice(
      $.string,
      $.number,
      $.boolean,
      $.enum_identifier,
      $.qualified_identifier,
      $.annotation_array,
      $.annotation_object,
    ),

    annotation_array: $ => seq('[', sepBy(',', $._annotation_value), ']'),
    annotation_object: $ => seq('{', sepBy(',', $.annotation_property), '}'),
    annotation_property: $ => seq(
      field('key', $.identifier),
      ':',
      field('value', $._annotation_value)
    ),

    // Define View Entity
    view_entity_definition: $ => prec.right(1, seq(
      repeat($.annotation),
      caseInsensitive('define'),
      optional(caseInsensitive('root')),
      caseInsensitive('view'),
      caseInsensitive('entity'),
      field('name', $.identifier),
      optional(field('parameters', $.parameter_clause)),
      caseInsensitive('as'),
      caseInsensitive('select'),
      caseInsensitive('from'),
      field('data_source', $.data_source),
      repeat($.join_clause),
      repeat($.association_clause),
      field('select_list', $.select_list),
      optional(';')
    )),

    // Define View Clássica
    view_definition: $ => prec.right(1, seq(
      repeat($.annotation),
      caseInsensitive('define'),
      caseInsensitive('view'),
      field('name', $.identifier),
      caseInsensitive('as'),
      caseInsensitive('select'),
      caseInsensitive('from'),
      field('data_source', $.data_source),
      repeat($.join_clause),
      repeat($.association_clause),
      field('select_list', $.select_list),
      optional(';')
    )),

    data_source: $ => seq(
      field('name', choice($.identifier, seq('/', $.identifier, '/', $.identifier))),
      optional(seq(caseInsensitive('as'), field('alias', $.identifier)))
    ),

    join_clause: $ => seq(
      choice(
        caseInsensitive('inner join'),
        caseInsensitive('left outer join'),
        caseInsensitive('right outer join'),
        caseInsensitive('cross join')
      ),
      field('target', $.data_source),
      caseInsensitive('on'),
      field('condition', $._expression)
    ),

    association_clause: $ => seq(
      repeat($.annotation),
      caseInsensitive('association'),
      optional(field('cardinality', $.cardinality)),
      caseInsensitive('to'),
      field('target', $.identifier),
      caseInsensitive('as'),
      field('alias', $.identifier),
      caseInsensitive('on'),
      field('condition', $._expression)
    ),

    cardinality: $ => seq(
      '[',
      choice(
        seq($.number, '..', choice($.number, '*')),
        choice($.number, '*')
      ),
      ']'
    ),

    parameter_clause: $ => seq(
      caseInsensitive('with parameters'),
      sepBy1(',', $.parameter)
    ),

    parameter: $ => seq(
      repeat($.annotation),
      field('name', $.identifier),
      ':',
      field('type', $.qualified_identifier)
    ),

    select_list: $ => seq(
      '{',
      sepBy(',', $.select_element),
      optional(','),
      '}'
    ),

    select_element: $ => seq(
      repeat($.annotation),
      optional(caseInsensitive('key')),
      field('expression', $._expression),
      optional(seq(caseInsensitive('as'), field('alias', $.identifier)))
    ),

    _expression: $ => choice(
      $.identifier,
      $.projection_reference,
      $.qualified_field,
      $.string,
      $.number,
      $.boolean,
      $.binary_expression,
      $.case_expression,
      $.function_call,
      $.cast_expression,
    ),

    qualified_field: $ => seq(
      field('source', $.identifier),
      '.',
      field('field', $.identifier)
    ),

    binary_expression: $ => prec.left(1, seq(
      field('left', $._expression),
      field('operator', choice('=', '!=', '<', '<=', '>', '>=', caseInsensitive('like'), caseInsensitive('and'), caseInsensitive('or'), '+', '-', '*', '/')),
      field('right', $._expression)
    )),

    case_expression: $ => seq(
      caseInsensitive('case'),
      repeat1($.when_clause),
      optional(seq(caseInsensitive('else'), $._expression)),
      caseInsensitive('end')
    ),

    when_clause: $ => seq(
      caseInsensitive('when'),
      field('condition', $._expression),
      caseInsensitive('then'),
      field('result', $._expression)
    ),

    function_call: $ => seq(
      field('function', $.identifier),
      '(',
      sepBy(',', $._expression),
      ')'
    ),

    cast_expression: $ => seq(
      caseInsensitive('cast'),
      '(',
      field('expression', $._expression),
      caseInsensitive('as'),
      field('type', $.qualified_identifier),
      ')'
    ),

    string: $ => /'[^']*'/,
    number: $ => /\d+(\.\d+)?/,
    boolean: $ => choice(caseInsensitive('true'), caseInsensitive('false')),
  }
});

function caseInsensitive(keyword) {
  return token(prec(1, new RegExp(
    keyword
      .split('')
      .map(letter => letter === ' ' ? '\\s+' : `[${letter.toLowerCase()}${letter.toUpperCase()}]`)
      .join('')
  )));
}

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
