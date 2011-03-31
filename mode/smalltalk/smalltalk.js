CodeMirror.defineMode("smalltalk", function(config, parserConfig) {
  var indentUnit = config.indentUnit, keywords = parserConfig.keywords;

  function chain(stream, state, f) {
    state.tokenize = f;
    return f(stream, state);
  }

  var type;
  function ret(tp, style) {
    type = tp;
    return style;
  }

  function tokenBase(stream, state) {
    var ch = stream.next();
	if (ch == '"')
      return chain(stream, state, tokenComment(ch));
    else if (ch == "'")
      return chain(stream, state, tokenString(ch));
    else if (ch == "#") {
      stream.eatWhile(/[\w\$_]/);
      return ret("string", "st-string");
    }
    else if (/\d/.test(ch)) {
      stream.eatWhile(/[\w\.]/)
      return ret("number", "st-number");
    }
    else {
      stream.eatWhile(/[\w\$_]/);
      if (keywords && keywords.propertyIsEnumerable(stream.current())) return ret("keyword", "st-keyword");
      return ret("word", "st-word");
    }
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next, end = false;
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) {end = true; break;}
        escaped = !escaped && next == "\\";
      }
      if (end || !(escaped))
        state.tokenize = tokenBase;
      return ret("string", "st-string");
    };
  }

  function tokenComment(quote) {
    return function(stream, state) {
      var next, end = false;
      while ((next = stream.next()) != null) {
        if (next == quote) {end = true; break;}
      }
      if (end)
        state.tokenize = tokenBase;
      return ret("comment", "st-comment");
    };
  }

  function Context(indented, column, type, align, prev) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.align = align;
    this.prev = prev;
  }

  function pushContext(state, col, type) {
    return state.context = new Context(state.indented, col, type, null, state.context);
  }
  function popContext(state) {
    return state.context = state.context.prev;
  }

  // Interface

  return {
    startState: function(basecolumn) {
      return {
        tokenize: tokenBase,
        context: new Context((basecolumn || 0) - indentUnit, 0, "top", false),
        indented: 0,
        startOfLine: true
      };
    },

    token: function(stream, state) {
      var ctx = state.context;
      if (stream.sol()) {
        if (ctx.align == null) ctx.align = false;
        state.indented = stream.indentation();
        state.startOfLine = true;
      }
      if (stream.eatSpace()) return null;
      var style = state.tokenize(stream, state);
      if (type == "comment") return style;
      if (ctx.align == null) ctx.align = true;

      if ((type == ";" || type == ":") && ctx.type == "statement") popContext(state);
      else if (type == "{") pushContext(state, stream.column(), "}");
      else if (type == "[") pushContext(state, stream.column(), "]");
      else if (type == "(") pushContext(state, stream.column(), ")");
      else if (type == "}") {
        if (ctx.type == "statement") ctx = popContext(state);
        if (ctx.type == "}") ctx = popContext(state);
        if (ctx.type == "statement") ctx = popContext(state);
      }
      else if (type == ctx.type) popContext(state);
      else if (ctx.type == "}") pushContext(state, stream.column(), "statement");
      state.startOfLine = false;
      return style;
    },

    indent: function(state, textAfter) {
      if (state.tokenize != tokenBase) return 0;
      var firstChar = textAfter && textAfter.charAt(0), ctx = state.context, closing = firstChar == ctx.type;
      if (ctx.type == "statement") return ctx.indented + (firstChar == "{" ? 0 : indentUnit);
      else if (ctx.align) return ctx.column + (closing ? 0 : 1);
      else return ctx.indented + (closing ? 0 : indentUnit);
    },

    electricChars: "{}"
  };
});

(function() {
  function keywords(str) {
    var obj = {}, words = str.split(" ");
    for (var i = 0; i < words.length; ++i) obj[words[i]] = true;
    return obj;
  }
  var stKeywords = "true false nil self super thisContext";

  CodeMirror.defineMIME("text/x-stsrc", {
    name: "smalltalk",
    keywords: keywords(stKeywords)
  });
}());