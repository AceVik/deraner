
// Include gulp
const gulp          = require('gulp');
const gutil         = require('gulp-util');
const gulpif        = require('gulp-if');
const replace       = require('gulp-replace');

const uglifyjs      = require('gulp-uglify');
const uglifycss     = require('gulp-uglifycss');
const uglifyhtml    = require('gulp-htmlmin');

const concat        = require('gulp-concat');
const concatFiles   = require('concat-files');
const concatenate   = require('concatenate');
const merge         = require('merge-stream');

const pug           = require('gulp-pug');
const sass          = require('gulp-sass');
const babel         = require('gulp-babel');
const typescript    = require('gulp-typescript');

const sourcemaps    = require('gulp-sourcemaps');

const { lstatSync,
    readdirSync,
    existsSync,
    readFileSync,
    mkdirSync
}                   = require('fs');
const { join }      = require('path');
const { spawnSync } = require('child_process');

const isDirectory = source => lstatSync(source).isDirectory()
const getDirectories = source =>
    readdirSync(source).map(name => join(source, name)).filter(isDirectory)

let deranerRootDir = existsSync('./deraner') && isDirectory('./deraner') ? 'deraner/' : '';

const env           = require('dotenv').config({path: deranerRootDir + '.env'}).parsed;

let cleanFilesList = new Array();

const tempDir = 'var/cache/' + env.APP_ENV;

if(!existsSync(tempDir) || !isDirectory(tempDir)) {
    mkdirSync(tempDir);
}

const IS_DEV = (env.APP_ENV == 'dev');

const builders = {
    sass        : sass,
    scss        : sass,
    babel       : babel,
    typescript  : typescript,
    ts          : typescript,
    pug         : pug,
    jade        : pug
};

const parseDestData = dest => {
    let idx = dest.indexOf(':');

    let dir = dest;
    let file = null;

    if(idx >= 0) {
        dir = dest.substr(0, idx);
        file = dest.substr(idx + 1);
    }

    return {
        path : dir,
        file : file
    };
};

const routes = (() => {
    let result = {};
    let proc = spawnSync('bin/console', ['debug:router']);

    if(proc.status != 0) {
        gutil.log(`Error! Could not execute 'bin/console debug:router'. Response: ${proc.stderr}`);
        return null;
    }

    const RouteName = 0;
    const RouteMethod = 1;
    const RouteScheme = 2;
    const RouteHost = 3;
    const RoutePath = 4;

    let lines = proc.stdout.toString().split(/\r?\n/);
    for(let i = 3; i < lines.length - 3; i++) {
        let line = lines[i].trim();

        let columns = line.split(/\s+/);

        result[columns[RouteName]] = {
            name: columns[RouteName],
            method: columns[RouteMethod],
            scheme: columns[RouteScheme],
            host: columns[RouteHost],
            path: columns[RoutePath]
        };
    }

    return result;
})();

const routeReplaceOptions = {
    regex: /(#route:\w+)/ig,
    replace: str => {
        let mt = /#route:(\w+)/ig.exec(str);

        if(mt[1] in routes) {
            return routes[mt[1]].path;
        }

        gutil.log('Warning: Route \'' + mt[1] + '\' not found!');

        return str;
    }
};

const templatesSrcDir = deranerRootDir + 'templates';
const templatesDestDir = deranerRootDir + 'public/templates';
const templatesSettingsFile = 'template.json';

let templates = null;
const forEachTemplate = callable => {
    if(templates === null) {
        templates = new Array();
        let dirs = getDirectories(templatesSrcDir);
        for(let i = 0; i < dirs.length; i++) {
            let path = dirs[i];
            let tplPath = path + '/' + templatesSettingsFile;
            if(existsSync(tplPath)) {
                let tpl = JSON.parse(readFileSync(tplPath, 'utf8'));
                let dpath = templatesDestDir + '/' + tpl.name;
                callable(tpl, path, dpath);
                templates.push({
                    path : path,
                    tpl : tpl,
                    dpath : dpath
                });
            }
        }
    } else {
        for(let i = 0; i < templates.length; i++) {
            var t = templates[i];
            callable(t.tpl, t.path, t.dpath);
        }
    }
};

const compile = (tpl, obj, path, destPath) => {
    let assets = obj || null;
    if(assets === null) return;

    const templateRootURI = '/templates/' + tpl.name;
    const assetsTemplateURI = templateRootURI + '/assets';
    const assetsRootURI = '/assets';

    const templateRootPublicPath = templatesDestDir + '/' + tpl.name;
    const assetsTemplatePublicPath = templateRootPublicPath + '/assets';
    const assetsRootPublicPath = deranerRootDir + 'public/assets';

    const uriReplaceOptions = {
        regex: /(#uri:.+?\.(?:js|css|png|jpg|jpeg|gif|svg))/ig,
        replace: str => {
            let mt = /#uri:(.+?\.(?:js|css|png|jpg|jpeg|gif|svg))/ig.exec(str);
            let fl = mt[1];

            let tmp = /\.(js|css)$/ig.exec(fl);
            let sub_uri = '/';

            if(tmp !== null) {
                sub_uri = '/' + tmp[1] + '/' + fl;
            } else if(/\.(png|jpg|jpeg|gif|svg)$/ig.test(str)) {
                sub_uri = '/img/' + fl;
            }

            if(existsSync(assetsTemplatePublicPath + sub_uri))
                return assetsTemplateURI + sub_uri;

            if(existsSync(assetsRootPublicPath + sub_uri))
                return assetsRootURI + sub_uri;

            gutil.log('Warning: Asset not found \'' + fl + '\'. Using template root URI as asset URI.');
            return templateRootURI + '/' + fl;

            return pth;
        }
    };

    let rets = new Array();

    for(let dest in assets) {
        let streams = new Array();
        let pipe = assets[dest];

        let dst = parseDestData(dest);

        for(let i = 0; i < pipe.length; i++) {
            let args = pipe[i];

            let fullSRC = new Array();

            let preconcats = new Array();

            if('src' in args) {
                if(typeof args.src == 'string') {
                    fullSRC.push(path + args.src);
                } else {
                    for(let i = 0; i < args.src.length; i++) {
                        if(typeof args.src[i] == 'string') {
                            fullSRC.push(path + args.src[i]);
                        } else {
                            let tmpFile = 'tmp' + i + dst.file || '';
                            let tmpFullSRC = new Array();

                            for(let c = 0; c < args.src[i].length; c++) {
                                tmpFullSRC.push(path + args.src[i][c]);
                            }

                            let filePath = tempDir + '/' + tmpFile;

                            console.log(tmpFullSRC);

                            concatenate(tmpFullSRC, filePath);

                            fullSRC.push(filePath);
                        }
                    }
                }
            } else {
                console.error('Compilation error! Missing src parameter.' + dest + ' could not be created.');
                continue;
            }

            let stream = null;

            let minify = ('minify' in args ? args.minify : !IS_DEV);
            let createSourceMaps = (('sourcemap' in args ? args.sourcemap : true) && IS_DEV);

            if('builder' in args) {
                if(args.builder in builders) {
                    let ugly = (new Array('scss', 'sass', 'less')).indexOf(args.builder) >= 0 ? uglifycss :
                        ((new Array('babel')).indexOf(args.builder) >= 0 ? uglifyjs : false);

                    if((new Array('pug', 'jade')).indexOf(args.builder) >= 0) {
                        ugly = uglifyhtml;
                        args.options = args.options || {};

                        args.options.pretty = IS_DEV ? args.options.pretty || true : false;

                        args.options.data = args.options.data || {};
                        args.options.data.template = args.options.data.template || {};
                        args.options.data.template.name = args.options.data.template.name || tpl.name || null;
                        args.options.data.template.author = args.options.data.template.author || tpl.author || null;
                        args.options.data.template.license = args.options.data.template.license || tpl.license || null;
                        args.options.data.template.version = args.options.data.template.version || tpl.version || null;
                        args.options.data.template.env = args.options.data.template.env || tpl.env || null;

                        args.options.data.env = env;

                        args.options.data.env.is_dev = args.options.data.env.is_dev || IS_DEV;
                    }

                    if(!ugly && minify) {
                        minify = false;
                        console.warn('Compilation warning! Unknown file type.' + dest + ' can not be minified.');
                    }

                    console.log(fullSRC);

                    if('options' in args) {
                        stream = gulp.src(fullSRC)
                            .pipe(replace(uriReplaceOptions.regex, uriReplaceOptions.replace))
                            .pipe(replace(routeReplaceOptions.regex, routeReplaceOptions.replace))
                            .pipe(gulpif(createSourceMaps, sourcemaps.init()))
                            .pipe(builders[args.builder](args.options))
                            .pipe(gulpif(minify, !ugly ? gutil.noop() : ugly().on('error', gutil.log)))
                            .pipe(gulpif(createSourceMaps, sourcemaps.write()));
                    } else {
                        stream = gulp.src(fullSRC)
                            .pipe(replace(uriReplaceOptions.regex, uriReplaceOptions.replace))
                            .pipe(replace(routeReplaceOptions.regex, routeReplaceOptions.replace))
                            .pipe(gulpif(createSourceMaps, sourcemaps.init()))
                            .pipe(builders[args.builder]())
                            .pipe(gulpif(minify, !ugly ? gutil.noop() : ugly().on('error', gutil.log)))
                            .pipe(gulpif(createSourceMaps, sourcemaps.write()));
                    }
                } else {
                    console.error('Compilation error! Unknown builder ' + args.builder + '. ' + dest + ' could not be created.');
                    stream = null;
                }
            } else {
                let ugly = ((dst.file !== null && dst.file.lastIndexOf('.css') > 0) || /^(?:.*\/)?css(?:\/.*)?$/.test(dst.path)) ? uglifycss :
                    ((dst.file !== null && dst.file.lastIndexOf('.js') > 0) || /^(?:.*\/)?js(?:\/.*)?$/.test(dst.path) ? uglifyjs :
                        ((dst.file !== null && dst.file.lastIndexOf('.html') > 0) || /^(?:.*\/)?template(?:\/.*)?$/.test(dst.path) ? uglifyhtml : false));

                if(!ugly && minify) {
                    minify = false;
                    console.warn('Compilation warning! Unknown file type.' + dest + ' can not be minified.');
                }

                stream = gulp.src(fullSRC).pipe(gulpif(minify, !ugly ? gutil.noop() : ugly().on('error', gutil.log)));
            }

            if(stream !== null) {
                streams.push(stream);
            }
        }


        if(dst.file !== null) {
            stm = merge(...streams).pipe(concat(dst.file)).pipe(gulp.dest(destPath + dst.path));
        } else {
            stm = merge(...streams).pipe(gulp.dest(destPath + dst.path));
        }

        rets.push(stm);
    }

    return rets;
};

gulp.task('assets', done => {
    gulp.src(deranerRootDir + 'assets/css/font-awesome/*.scss')
        .pipe(sass())
        .pipe(concat('font-awesome5.css'))
        .pipe(uglifycss())
        .pipe(gulp.dest(deranerRootDir + 'public/assets/css'));

    gulp.src(deranerRootDir + 'assets/webfonts/*')
        .pipe(gulp.dest(deranerRootDir + 'public/assets/webfonts'));

    let min = (!IS_DEV ? '.min' : '');

    // ##################### Vue.js #####################
    gulp.src('node_modules/vue/dist/vue' + min + '.js')
        .pipe(concat('vue.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    gulp.src('node_modules/vee-validate/dist/vee-validate' + min + '.js')
        .pipe(concat('vee-validate.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    // ##################### jQuery #####################
    gulp.src('node_modules/jquery/dist/jquery' + min + '.js')
        .pipe(concat('jquery.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    gulp.src('node_modules/jquery/dist/jquery.slim' + min + '.js')
        .pipe(concat('jquery.slim.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    // ##################### Popper #####################
    gulp.src('node_modules/popper.js/dist/popper' + min + '.js')
        .pipe(concat('popper.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    gulp.src('node_modules/popper.js/dist/popper-utils' + min + '.js')
        .pipe(concat('popper-utils.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    // ################### Bootstrap ####################
    gulp.src('node_modules/bootstrap/dist/css/bootstrap' + min + '.css')
        .pipe(concat('bootstrap.css'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/css'));

    gulp.src('node_modules/bootstrap/dist/css/bootstrap-grid' + min + '.css')
        .pipe(concat('bootstrap-grid.css'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/css'));

    gulp.src('node_modules/bootstrap/dist/css/bootstrap-reboot' + min + '.css')
        .pipe(concat('bootstrap-reboot.css'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/css'));

    gulp.src('node_modules/bootstrap/dist/js/bootstrap' + min + '.js')
        .pipe(concat('bootstrap.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

    gulp.src('node_modules/bootstrap/dist/js/bootstrap.bundle' + min + '.js')
        .pipe(concat('bootstrap.bundle.js'))
        .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));

        merge(  gulp.src(deranerRootDir + 'node_modules/axios/dist/axios' + min + '.js'),
                gulp.src([
                    deranerRootDir + 'assets/js/*.js',
                    deranerRootDir + 'assets/js/Deraner.js'])
                    .pipe(gulpif(IS_DEV, sourcemaps.init()))
                    .pipe(concat('deraner.js'))
                    .pipe(babel({
                        "presets" : ["env"]
                    }))
                    .pipe(replace(routeReplaceOptions.regex, routeReplaceOptions.replace))
                    .pipe(gulpif(!IS_DEV, uglifyjs()))
                    .pipe(gulpif(IS_DEV, sourcemaps.write()))
        ).pipe(concat('deraner.js'))
         .pipe(gulp.dest(deranerRootDir + 'public/assets/js'));


    gulp.src(deranerRootDir + 'assets/img/*')
        .pipe(gulp.dest(deranerRootDir + 'public/assets/img'));

    done();
});

gulp.task('template-assets', done => {
    forEachTemplate((tpl, path, dpath) => {
        gutil.log('Compiling template-assets for template \'' + tpl.name + '\' ...');
        compile(tpl, tpl.assets, path + '/assets/', dpath + '/assets/');
    });

    done();
});

gulp.task('templates', done => {
    forEachTemplate((tpl, path, dpath) => {
        gutil.log('Compiling template \'' + tpl.name + '\' ...');
        compile(tpl, tpl.templates, path + '/', dpath + '/');
    });

    done();
});


gulp.task('default', gulp.series('assets', 'template-assets', 'templates'));
