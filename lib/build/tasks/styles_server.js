/**
* @fileoverview server模式，样式处理
* @author  liweitao
*/

'use strict';

module.exports = function ($, appConf, moduleConf, args) {
  return function (mod, modulePath, appPath) {
    return new Promise(function (resolve, reject) {
      var through2 = require('through2');
      var sprites = require('athena-spritesmith');
      var autoprefixer = require('autoprefixer');
      var vfs = require('vinyl-fs');
      var path = require('path');
      var pxtorem = require('postcss-pxtorem');

      var athenaMate = require('../athena_mate');
      //是否开启px转rem
      var px2rem = moduleConf.support.px2rem;
      //是否开启雪碧图合并
      var csssprite = moduleConf.support.csssprite;

      var platform = appConf.platform ? appConf.platform : 'mobile';

      var autoprefixerConf = moduleConf.support.autoprefixer;
      var browsers = [];
      if (autoprefixerConf) {
        browsers = autoprefixerConf[platform];
      } else {
        browsers = ['> 1%', 'last 2 versions', 'Firefox ESR', 'Opera 12.1'];
      }

      var processors = [
        autoprefixer({browsers: browsers})
      ];

      if(px2rem && px2rem.enable !== false){
        processors.push(pxtorem({
          root_value: px2rem.root_value,
          unit_precision: px2rem.unit_precision,
          prop_white_list: px2rem.prop_white_list,
          selector_black_list: px2rem.selector_black_list,
          replace: px2rem.replace,
          media_query: px2rem.media_query
        }));
      }

      if(csssprite && csssprite.enable !== false){
        var opts = {
          outputDimensions: true,
          stylesheetPath: path.join(modulePath, 'dist', '_static', 'css'),
          imageFolder: 'images',
          spritePath: path.join(modulePath, 'dist', '_static', 'images', csssprite.spriteFolder ? csssprite.spriteFolder : '', 'sprite.png'),
          retina: csssprite.retina || false,
          rootValue: csssprite.rootValue,
          padding: csssprite.padding,
          groupBy: function (image) {
            return image.urlSpe;
          }
        };
      }

      $.util.log($.util.colors.green('开始' + mod + '模块任务styles！'));
      var fileContents = [];
      vfs.src([path.join(modulePath, 'dist', '_static', '**', '*.css'), path.join('!' + modulePath, 'dist', '_static', '**', '*.min.css')])
        .pipe(athenaMate.plumber())
        .pipe($.postcss(processors))
        .pipe(vfs.dest(path.join(modulePath, 'dist', '_static')))
        .pipe(through2.obj(function (file, enc, cb) {
          if (file.isNull() || file.isStream()) {
            return cb(null, file);
          }
          fileContents.push('/*filepath=' + file.path + '*/\n' + file.contents.toString());
          cb();
        }, function (cb) {
          var file = new $.util.File({
            path: path.join(modulePath, 'dist', '_static', 'css', 'sprite.css'),
            base: path.join(modulePath, 'dist', '_static', 'css'),
            contents: new Buffer(fileContents.join('\n/*sprite_file_split*/\n'))
          });
          this.push(file);
          cb();
        }))
        .pipe($.postcss([sprites(opts)]))
        .pipe(through2.obj(function (file, enc, cb) {
          if (file.isNull() || file.isStream()) {
            return cb(null, file);
          }
          var content = file.contents.toString();
          fileContents = content.split('/*sprite_file_split*/');
          fileContents.forEach(function (item) {
            var reg = /filepath=(.*)\*/;
            var filepath = item.match(reg)[1];
            var file = new $.util.File({
              path: filepath,
              base: path.join(modulePath, 'dist', '_static'),
              contents: new Buffer(item)
            });
            this.push(file);
          }.bind(this));
          cb();
        }))
        .pipe(vfs.dest(path.join(modulePath, 'dist', '_static')))
        .on('end', function () {
          $.util.log($.util.colors.green('结束' + mod + '模块任务styles！'));
          resolve();
        })
        .on('error', function (err) {
          $.util.log($.util.colors.red(mod + '模块任务styles失败！'));
          reject(err);
        });
    });
  };
};
