var seqCount = 0;
var usedIds = {};
var makeUnique = {
  'index.html': true,
  'style.css': true,
  'script.js': true,
  'unit.js': true,
  'spec.js': true,
  'scenario.js': true
}

function ids(list) {
  return list.map(function(item) { return item.id; }).join(' ');
};


exports.Example = function(scenarios) {
  this.module = '';
  this.deps = [];
  this.html = [];
  this.css = [];
  this.js = [];
  this.json = [];
  this.unit = [];
  this.scenario = [];
  this.scenarios = scenarios;
  this.baseUrl = '';
}

exports.Example.prototype.setModule = function(module) {
  if (module) {
    this.module = module;
  }
};

exports.Example.prototype.setHeight = function(height) {
  if(height) {
    this.height = height;
  }
}

exports.Example.prototype.addDeps = function(deps) {
  deps && deps.split(/[\s\,]/).forEach(function(dep) {
    if (dep) {
      this.deps.push(dep);
    }
  }, this);
};

exports.Example.prototype.setBaseUrl = function(baseUrl) {
  this.baseUrl = baseUrl;
}

exports.Example.prototype.addSource = function(name, content) {
  var ext = name == 'scenario.js' ? 'scenario' : name.split('.')[1],
      id = name;

  if (makeUnique[name] && usedIds[id]) {
    id = name + '-' + (seqCount++);
  }
  usedIds[id] = true;
  
  this[ext].push({name: name, content: content, id: id});
  if (name.match(/\.js$/) && name !== 'spec.js' && name !== 'unit.js' && name != 'scenario.js') {
    this.deps.push(name);
  }
  if (ext == 'scenario') {
    this.scenarios.push(content);
  }
};

exports.Example.prototype.enableAnimations = function() {
  this.animations = true;
};

exports.Example.prototype.disableAnimations = function() {
  this.animations = false;
};

exports.Example.prototype.toHtml = function(exampleFilename) {
  var html = "<h2>Source</h2>\n";
  html += this.toHtmlEdit();
  html += this.toHtmlTabs();
  if(this.animations) {
    html += '<div class="pull-right">';
    html += ' <button class="btn btn-primary" ng-click="animationsOff=true" ng-hide="animationsOff">Animations on</button>';
    html += ' <button class="btn btn-primary disabled" ng-click="animationsOff=false" ng-show="animationsOff">Animations off</button>';
    html += '</div>';
  }
  html += "<h2>Demo</h2>\n";
  
  var embedConfig = this.toEmbedConfig();
  if(embedConfig) {
    html += '<div class="example-frame well"><iframe ';
    if(this.height) {
      html += 'style="height:' + this.height + 'px" ';
    }
    html += 'src="' + exampleFilename + '"></iframe></div>';
  }
  return html;
};


exports.Example.prototype.toHtmlEdit = function() {
  var out = [];
  out.push('<div source-edit="' + this.module + '"');
  out.push(' source-edit-deps="' + this.deps.join(' ') + '"');
  out.push(' source-edit-html="' + ids(this.html) + '"');
  out.push(' source-edit-css="' + ids(this.css) + '"');
  out.push(' source-edit-js="' + ids(this.js) + '"');
  out.push(' source-edit-json="' + ids(this.json) + '"');
  out.push(' source-edit-unit="' + ids(this.unit) + '"');
  out.push(' source-edit-scenario="' + ids(this.scenario) + '"');
  out.push(' source-edit-base-url="' + this.baseUrl + '"');
  out.push('></div>\n');
  return out.join('');
};

exports.Example.prototype.toHtmlTabs = function() {
  var out = [],
      self = this;

  out.push('<div class="tabbable">');
  htmlTabs(this.html);
  htmlTabs(this.css);
  htmlTabs(this.js);
  htmlTabs(this.json);
  htmlTabs(this.unit);
  htmlTabs(this.scenario);
  out.push('</div>');
  return out.join('');

  function htmlTabs(sources) {
    sources.forEach(function(source) {
      var wrap = '',
          isCss = source.name.match(/\.css$/),
          name = source.name;

      if (name === 'index.html') {
        wrap = ' ng-html-wrap-loaded="' + self.module + ' ' + self.deps.join(' ') + '"';
      }
      if (name == 'scenario.js') name = 'End to end test';

      out.push(
        '<div class="tab-pane" title="' + name + '">\n' +
          '<pre class="prettyprint linenums" ng-set-text="' + source.id + '"' + wrap + '></pre>\n' +
          (isCss
             ? ('<style type="text/css" id="' + source.id + '">' + source.content + '</style>\n')
             : ('<script type="text/ng-template" id="' + source.id + '">' + source.content + '</script>\n') ) +
        '</div>\n');
    });
  }
};

exports.Example.prototype.toEmbedConfig = function() {
  return this.module || this.html || this.js
    ? {
      module: this.module,
      html: this.html,
      js: this.js
    }
    : null;
};

