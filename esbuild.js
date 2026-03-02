const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const options = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    platform: 'node',
    target: 'node18',
    sourcemap: true,
};

if (isWatch) {
    esbuild.context(options).then(ctx => ctx.watch());
} else {
    esbuild.build(options);
}
