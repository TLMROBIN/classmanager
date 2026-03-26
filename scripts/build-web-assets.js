const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const vendorDir = path.join(publicDir, 'vendor');

const ensureDir = (dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
};

const copyFile = (from, to) => {
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
    console.log(`copied ${path.relative(projectRoot, from)} -> ${path.relative(projectRoot, to)}`);
};

const vendorFiles = [
    ['node_modules/react/umd/react.production.min.js', 'public/vendor/react.production.min.js'],
    ['node_modules/react-dom/umd/react-dom.production.min.js', 'public/vendor/react-dom.production.min.js'],
    ['node_modules/xlsx/dist/xlsx.full.min.js', 'public/vendor/xlsx.full.min.js']
];

vendorFiles.forEach(([from, to]) => {
    copyFile(path.join(projectRoot, from), path.join(projectRoot, to));
});

const tailwindCli = path.join(projectRoot, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const tailwindInput = path.join(publicDir, 'tailwind.input.css');
const tailwindOutput = path.join(vendorDir, 'tailwind.css');
const tailwindConfig = path.join(projectRoot, 'tailwind.config.js');

ensureDir(vendorDir);

const result = spawnSync(
    process.execPath,
    [
        tailwindCli,
        '-c',
        tailwindConfig,
        '-i',
        tailwindInput,
        '-o',
        tailwindOutput,
        '--minify'
    ],
    {
        cwd: projectRoot,
        stdio: 'inherit'
    }
);

if (result.status !== 0) {
    process.exit(result.status || 1);
}

console.log(`built ${path.relative(projectRoot, tailwindOutput)}`);
