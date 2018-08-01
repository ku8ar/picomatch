'use strict';

const parse = require('./parse');

function picomatch(list, patterns, options = {}) {
  if (typeof list === 'string') {
    list = [list];
  }

  if (typeof patterns === 'string') {
    return picomatch.match(list, patterns, options);
  }

  if (list.length === 0 || patterns.length === 0) {
    return [];
  }

  if (patterns.length === 1) {
    return picomatch.match(list, patterns[0], options);
  }

  let omit = [];
  let keep = [];

  for (const pattern of patterns) {
    if (typeof pattern === 'string' && pattern[0] === '!' && options.nonegate !== true) {
      omit.push.apply(omit, picomatch.match(list, pattern.slice(1), options));
    } else {
      keep.push.apply(keep, picomatch.match(list, pattern, options));
    }
  }

  if (omit.length) {
    if (!keep.length) keep = list.slice();
    for (const ele of omit) {
      keep.splice(keep.indexOf(ele), 1);
    }
  }

  return keep;
}

picomatch.match = (list, pattern, options = {}) => {
  const negated = options.nonegate !== true && pattern[0] === '!';
  if (negated) pattern = pattern.slice(1);

  const isMatch = picomatch.matcher(pattern, options, negated);
  const matches = [];
  const rest = [];

  for (const str of list) {
    if (isMatch(str)) {
      matches.push(str);
    } else {
      rest.push(str);
    }
  }

  if (negated) {
    return rest;
  }
  return matches;
};

picomatch.matcher = (pattern, options, negated) => {
  const regex = picomatch.makeRe(pattern, options, negated);
  return str => regex.test(str);
};

picomatch.isMatch = (str, pattern, options, negated) => {
  if (pattern.trim() === '') {
    return str === pattern;
  }

  if (!/[!*+?(){}[\]]/.test(pattern)) {
    if (str === pattern || unixify(str) === unixify(pattern)) {
      return true;
    }
    if (pattern.slice(0, 2) === './') {
      return str === pattern.slice(2);
    }
    return false;
  }

  return picomatch.matcher(pattern, options, negated)(str);
};

picomatch.makeRe = (str, options, negated) => {
  let regex = !options && picomatch.memo(str);
  if (!regex) {
    const state = picomatch.parse(str, options, negated);
    const source = picomatch.compile(state, options, negated);
    const flags = options && (options.flags || options.nocase ? 'i' : '');
    regex = new RegExp(source, flags);
    regex.pattern = str;
    regex.state = state;
    if (typeof negated === 'undefined') {
      picomatch.memo(str, regex);
    }
  }
  return regex;
};

picomatch.parse = (str, options, negated) => {
  return parse(str, options, negated);
}

picomatch.compile = (state, options) => {
  if (typeof state === 'string') state = picomatch.parse(state, options);
  return state.prefix + state.stash.map(tok => tok.value).join('\\/') + state.suffix;
};

picomatch.memo = (pattern, regex) => {
  picomatch.cache = picomatch.cache || {};
  if (typeof regex === 'undefined') {
    return picomatch.cache[pattern];
  }
  picomatch.cache[pattern] = regex;
};

picomatch.clearCache = () => (picomatch.cache = {});
picomatch.set = (pattern, regex) => {
  picomatch.cache[pattern] = regex;
  return picomatch;
};

picomatch.defaults = () => {
  picomatch.set('**/**', /./);
  picomatch.set('**', /./);
};

function stackType(ch) {
  switch (ch) {
    case '<':
    case '>':
      return 'angles';
    case '{':
    case '}':
      return 'braces';
    case '[':
    case ']':
      return 'brackets';
    case '(':
    case ')':
      return 'parens';
    default: {
      return 'other';
    }
  }
}

function unixify(filepath) {
  return filepath.replace(/\\+/g, '/');
}

const memoize = (fn, max = 100) => {
  const memo = [];

  return input => {
    for (let i = 0; i < memo.length; i++) {
      if (memo[i].input === input) {
        const temp = memo[0];
        memo[0] = memo[i];
        memo[i] = temp;
        return memo[0].result;
      }
    }

    const result = fn(input);
    memo.push({input, result});

    if (memo.length > max) {
      memo.unshift();
    }
    return result;
  };
};

module.exports = picomatch;
