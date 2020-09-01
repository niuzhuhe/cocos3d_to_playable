import * as fs from "fs"//导入nodejs里的文件模块
import * as path from "path"//导入nodejs里的路径模块
import * as uglify from "uglify-js"//npm压缩器
import * as webp from 'webp-converter';
import CleanCSS = require("clean-css")//针对Node.js平台和任何现代浏览器的快速高效的CSS优化器

export namespace X {
    const C = {
        BASE_PATH: "src/web-mobile",            
        RES_PATH: "src/web-mobile/res",//资源路径       
        RES_BASE64_EXTNAME_SET: new Set([      
            ".png", ".jpg", ".webp", ".mp3",".wav",".mtl",".bin"
        ]),
        OUTPUT_RES_JS: "dist/res.js",           
        OUTPUT_INDEX_HTML: "dist/index.html",  
        INPUT_HTML_FILE: "src/web-mobile/index.html",//cocos发布的html
        INPUT_CSS_FILES: [
            "src/web-mobile/style.css"//cocos手机适配css
        ],
        INPUT_JS_FILES: [
            "dist/res.js",         
            "src/web-mobile/src/polyfills.bundle.js",  
            "src/web-mobile/src/project.js",//cocos内置脚本
            "src/web-mobile/src/settings.js",//cocos内置脚本
            "src/web-mobile/src/system.bundle.js",

            "src/web-mobile/cocos3d-js.min.js",//coccos引擎库
            "src/web-mobile/main.js",//cocos主要逻辑脚本文件
        ],
    }
    var bundlePath="";
    //将文件中的图片音乐等资源转换成base64
    function get_file_content(filepath: string): string {
        let file = fs.readFileSync(filepath)
        // console.log(path.extname(filepath))
        return C.RES_BASE64_EXTNAME_SET.has(path.extname(filepath)) ? file.toString("base64") : file.toString()
    }


    function get_all_child_file(filepath: string): string[] {
        let children = [filepath]
        for (; ;) {
            // 如果都是file类型的,则跳出循环
            if (children.every(v => fs.statSync(v).isFile())) { break }
            // 如果至少有1个directroy类型,则删除这一项,并加入其子项
            children.forEach((child, i) => {
                if (fs.statSync(child).isDirectory()) {
                    delete children[i]
                    let child_children = fs.readdirSync(child).map(v => `${child}/${v}`)
                    children.push(...child_children)
                }
            })
        }
        return children
    }

    /**
     * 将所有res路径下的资源转化为res.js
     * - 存储方式为:res-url(注意是相对的),res文件内容字符串或编码
     */
    function write_resjs() {
        // 读取并写入到一个对象中
        let res_object = {}
        get_all_child_file(C.RES_PATH).forEach(path => {
            // console.log(path);
            // 注意,存储时删除BASE_PATH前置
            let store_path = path.replace(new RegExp(`^${C.BASE_PATH}/`), "")
            // console.log("store_path:",store_path);
            res_object[store_path] = get_file_content(path)
        })

        // console.log(res_object)

        // 写入文件
        fs.writeFileSync(C.OUTPUT_RES_JS, `window.res=${JSON.stringify(res_object)}`)
    }

    /** 将js文件转化为html文件内容(包括最小化过程) */
    function get_html_code_by_js_file(js_filepath: string): string {
        //gulp将文件最小化
        // console.log(js_filepath)
        let js = get_file_content(js_filepath)
        // console.log(js)
        let min_js = ''
        //引擎包已经压缩过
        if(js_filepath === 'src/web-mobile/cocos3d-js.min.js' || js_filepath === 'src/web-mobile/main.js' || js_filepath === 'src/web-mobile/src/system.bundle.js' ){
           min_js = js
        } else {
           min_js = uglify.minify(js).code
        }
        // console.log(min_js);

        return `<script type="text/javascript">${min_js}</script>`
    }

    /** 将css文件转化为html文件内容(包括压缩过程) */
    function get_html_code_by_css_file(css_filepath: string): string {
        let css = get_file_content(css_filepath)
        let min_css = new CleanCSS().minify(css).styles
        return `<style>${min_css}</style>`
    }
    
    //先判断bundle.js是否存在
    export function judge_bundlefile_isHave(files:string){
        fs.access(files, (err) => {
            console.log("err----:",err)
            if(err == null){
                let bundleJs = fs.readFileSync(files).toString();
                let bundles = 'window.loadBundleJs=function(){' + bundleJs + '}'
                fs.writeFileSync(files, bundles);
                C.INPUT_JS_FILES.splice(1,0,'src/web-mobile/src/chunks/bundle.js')
                bundlePath="window.loadBundleJs();"
                console.log("bundleJs存在：",C.INPUT_JS_FILES[1])
            }
            X.do_task();
        });
    }

    /** 执行任务 */
    export function do_task() {
        console.time("修改引擎模块代码")
        //==================替换cocos3d-js.min.js中的部分代码=============================
        let cocos3djs = fs.readFileSync('./src/web-mobile/cocos3d-js.min.js').toString();
        cocos3djs = cocos3djs.replace('System.register([]','System.register("cc", []');//注册cc
        fs.writeFileSync('./src/web-mobile/cocos3d-js.min.js', cocos3djs)
        //================================

        //==================替换project.js中的部分代码===
        let projectJs = fs.readFileSync('./src/web-mobile/src/project.js').toString();
        let projects='window.loadProjectJs=function(){'+projectJs+'}'
        fs.writeFileSync('./src/web-mobile/src/project.js', projects)
        //================================

        //==================替换main.js中的部分代码=====
        //写入读取资源方式
        let main = fs.readFileSync('./src/web-mobile/main.js').toString();
        let resLoader = fs.readFileSync('./src/new-res-loader.js').toString();
        let res ='then('+ resLoader+ ')';
        main=main.replace('then(boot)',res);

        main=main.replace('return Promise.resolve(prepare.engine ? prepare.engine() : void 0)','return Promise.resolve()');
        main=main.replace('return loadScriptPackages(settings.scriptPackages);',bundlePath+'window.loadProjectJs();return Promise.resolve();');
        main=main.replace('if (jsList)','if (false)');
        
        fs.writeFileSync('./src/web-mobile/main.js', main)
        // console.log("main:",main)
        //===================================
        console.timeEnd("修改引擎模块代码")
    
        // 前置:将res资源写成res.js
        console.time("写入res.js")
        write_resjs()
        console.timeEnd("写入res.js")

        // 清理html===============================================================
        console.time("清理html")
        let html = get_file_content(C.INPUT_HTML_FILE)
        html = html.replace(/<link rel="stylesheet".*\/>/gs, "")
        html = html.replace(/<script.*<\/script>/gs, "")
        console.timeEnd("清理html")

        // 写入css================================================================
        console.time("写入所有css文件")
        C.INPUT_CSS_FILES.forEach(v => {
            console.time(`---${path.basename(v)}`)
            html = html.replace(/<\/head>/, `${get_html_code_by_css_file(v)}\n</head>`)
            console.timeEnd(`---${path.basename(v)}`)
        })
        console.timeEnd("写入所有css文件")

        // 写入js================================================================
        console.time("写入所有js到html")
        let scriptArr = ''
        C.INPUT_JS_FILES.forEach(v => {
            console.time(`---${path.basename(v)}`)
            scriptArr += `${get_html_code_by_js_file(v)}\n`
            console.timeEnd(`---${path.basename(v)}`)
        })
        html = html.replace(/<\/body>/, `${scriptArr}\n</body>`)
        console.timeEnd("写入所有js到html")


        // 写入文件并提示成功================================================================
        console.time("输出html文件")
        html=html.replace(/<\/body>&/,'')
        html=html.replace('splash.png','')
        fs.writeFileSync(C.OUTPUT_INDEX_HTML, html)
        console.timeEnd("输出html文件")
    }
}
//==================替换bundle.js中的部分代码========
X.judge_bundlefile_isHave('./src/web-mobile/src/chunks/bundle.js')
 //================================


