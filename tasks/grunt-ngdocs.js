/*
 * grunt-ngdocs
 * https://github.com/m7r/grunt-ngdocs
 *
 * Copyright (c) 2013 m7r
 * Licensed under the MIT license.
 */

var reader = require('../src/reader.js'),
    ngdoc = require('../src/ngdoc.js'),
    path = require('path'),
    vm = require('vm');

module.exports = function(grunt) {
  var _ = grunt.util._,
      templates = path.resolve(__dirname, '../src/templates');

  grunt.registerMultiTask('ngdocs', 'build documentation', function() {
    var start = now(),
        done = this.async(),
        options = this.options({
          dest: 'docs/',
          startPage: '/api',
          scripts: ['angular.js'],
          styles: [],
          example: null,
          title: grunt.config('pkg') ?
            (grunt.config('pkg').title || grunt.config('pkg').name) :
            '',
          html5Mode: true,
          editExample: true
        }),
        section = this.target === 'all' ? 'api' : this.target,
        setup;

    var httpPattern = /^((https?:)?\/\/|\.\.\/)/;
    
    // Copy the scripts into their own folder in docs, unless they are remote or default angular.js
    var gruntScriptsFolder = 'grunt-scripts';
    options.scripts = _.map(options.scripts, function(file) {
      if (file === 'angular.js') {
        return 'js/angular.min.js';
      }

      if (httpPattern.test(file)) {
        return file;
      } else {
        return copyWithPath(file, gruntScriptsFolder, options.dest);
      }
    });

    if (options.image) {
      if (!httpPattern.test(options.image)) {
        grunt.file.copy(options.image, path.join(options.dest, 'img', options.image));
        options.image = "img/" + options.image;
      }
    }

    options.styles = _.map(options.styles, function(file) {
      if (httpPattern.test(file)) {
        return file;
      } else {
        return copyWithPath(file, 'css', options.dest);
      }
    });
    
    if(options.example) {
      options.example.scripts = _.map(options.example.scripts, function(file) {
        if(httpPattern.test(file)) {
          return file;
        } else {
          var examplePath = copyWithPath(file, path.join('example', 'scripts'), options.dest);
          return examplePath.substr(8);
        }
      });
      
      // Copy styles folder and get path to styles files that should be linked
      var __styles = [];
      _.each(options.example.styles, function(styles) {
        _.each(styles, function(styles, styleFolder) {
          _.each(grunt.file.expand(styleFolder + '/**/*'), function(file) {
            if(!grunt.file.isDir(file)) {
              copyWithPath(file, path.join('example', 'styles'), options.dest);
            }
          });
          
          _.each(styles, function(style) {
            __styles.push(path.join('styles', styleFolder, style));
          });
        });
      });
      
      options.example.styles = __styles;
    }
    
    setup = prepareSetup(section, options);

    grunt.log.writeln('Generating Documentation...');

    reader.docs = [];
    this.files.forEach(function(f) {
      setup.sections[section] = f.title || 'API Documentation';
      setup.apis[section] = f.api || section == 'api';
      f.src.filter(exists).forEach(function(filepath) {
        var content = grunt.file.read(filepath);
        reader.process(content, filepath, section, options);
      });
    });

    ngdoc.merge(reader.docs);

    reader.docs.forEach(function(doc){
      // this hack is here because on OSX angular.module and angular.Module map to the same file.
      var id = doc.id.replace('angular.Module', 'angular.IModule').replace(':', '.'),
          file = path.resolve(options.dest, 'partials', doc.section, id + '.html'),
          exampleFile = path.resolve(options.dest, 'example', id + '.html');
          
      grunt.file.write(file, doc.html());
      
      if(doc.exampleEmbedConfig) {
        var data = _.extend({ config: options.example }, doc.exampleEmbedConfig);
        var content = grunt.file.read(path.resolve(templates, 'example.tmpl'));
        content = grunt.template.process(content, { data: data });
        grunt.file.write(exampleFile, content);
      }
    });

    ngdoc.checkBrokenLinks(reader.docs, setup.apis, options);

    setup.pages = _.union(setup.pages, ngdoc.metadata(reader.docs));

    if (options.navTemplate) {
      options.navContent = grunt.template.process(grunt.file.read(options.navTemplate));
    } else {
      options.navContent = '';
    }

    writeSetup(setup);

    grunt.log.writeln('DONE. Generated ' + reader.docs.length + ' pages in ' + (now()-start) + 'ms.');
    done();
  });
  
  function copyWithPath(src, dest, outputPath) {
    grunt.file.copy(src, path.join(outputPath, dest, src));
    return path.join(dest, src);
  }
 
  function prepareSetup(section, options) {
    var setup, data, context = {},
        file = path.resolve(options.dest, 'js/docs-setup.js');
    if (exists(file)) {
      // read setup from file
      data = grunt.file.read(file),
      vm.runInNewContext(data, context, file);
      setup = context.NG_DOCS;
      // keep only pages from other build tasks
      setup.pages = _.filter(setup.pages, function(p) {return p.section !== section;});
    } else {
      // build clean dest
      setup = {sections: {}, pages: [], apis: {}};
      copyTemplates(options.dest);
    }
    setup.__file = file;
    setup.__options = options;
    return setup;
  }

  function writeSetup(setup) {
    var options = setup.__options,
        content, data = {
          scripts: options.scripts,
          styles: options.styles,
          example: options.example,
          sections: _.keys(setup.sections).join('|'),
          discussions: options.discussions,
          analytics: options.analytics,
          navContent: options.navContent,
          title: options.title,
          image: options.image,
          titleLink: options.titleLink,
          imageLink: options.imageLink,
          bestMatch: options.bestMatch,
          deferLoad: !!options.deferLoad
        };

    // create index.html
    content = grunt.file.read(path.resolve(templates, 'index.tmpl'));
    content = grunt.template.process(content, {data:data});
    grunt.file.write(path.resolve(options.dest, 'index.html'), content);

    // create setup file
    setup.html5Mode = options.html5Mode;
    setup.editExample = options.editExample;
    setup.startPage = options.startPage;
    setup.discussions = options.discussions;
    setup.scripts = _.map(options.scripts, function(url) { return path.basename(url); });
    setup.example = setup.example,
    grunt.file.write(setup.__file, 'NG_DOCS=' + JSON.stringify(setup, replacer, 2) + ';');
  }


  function copyTemplates(dest) {
    grunt.file.expandMapping(['**/*', '!**/*.tmpl'], dest, {cwd: templates}).forEach(function(f) {
      var src = f.src[0],
          dest = f.dest;
      if (grunt.file.isDir(src)) {
          grunt.file.mkdir(dest);
        } else {
          grunt.file.copy(src, dest);
        }
    });
  }

  function exists(filepath) {
    return !!grunt.file.exists(filepath);
  }

  function replacer(key, value) {
    if (key.substr(0,2) === '__') {
      return undefined;
    }
    return value;
  }

  function now() { return new Date().getTime(); }

 };
