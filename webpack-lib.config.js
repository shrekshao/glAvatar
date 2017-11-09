var path = require('path');
var webpack = require('webpack');
// var HtmlWebpackPlugin = require('html-webpack-plugin');
// const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  entry: {
    lib: './demo/src/gl-avatar-system.js'
  },
  resolve: {
      alias: {
        Lib: path.resolve(__dirname, 'demo/lib/'),
        Shaders: path.resolve(__dirname, 'demo/lib/src/shaders')
      }
  },
  output: {
    filename: 'gl-avatar-system.js',
    path: path.resolve(__dirname, 'build-gl-avatar-system'),
    library: 'glAvatarSystem',
    libraryTarget: 'umd'
  },
  module: {
    rules: [
        {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader'
            ]
        },
        {
            test: /\.(png|jpg|gif)$/,
            use: [
                'file-loader'
            ]
        },
        {
            test: /\.(glsl|vs|fs)$/,
            use: [
                'shader-loader'
            ]
        }
    ],
    // loaders: [
    //   {
    //     test: /\.glsl$/,
    //     loader: "webpack-glsl"
    //   },
    // ]
  },
  plugins: [
      
  ]
};