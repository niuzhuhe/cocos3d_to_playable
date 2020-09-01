# cocos3d_to_playable

1、目前是以cocos3d1.1.0版本为基础写的
2、工具包中需要自行下载node_modules模块。
3、增加了webp工具格式转换，能进一步压缩包体大小。目录：'./python'
4、修改了new-res-loader.js脚本。window.boot()写在了这个脚本的最后边执行
5、修改了start.ts脚本。详情见此脚本引擎打包写法。
(注---修改js列表：
bundle.js,//判断是否存在插件的js
cocos3d-js.min.js,
project.js,
main.js,
实验了很多次，需要改动的都已经完善。未来再遇见的bug再进一步完善。）
