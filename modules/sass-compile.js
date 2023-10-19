const path = require('path');
const fs = require('fs');
const sass = require('sass');
const sourceMap = process.env.NODE_ENV !== "production";
const filenames = ["main", "admin"];

filenames.forEach(name => {
    const file = path.join(__dirname, "../public/css", name + ".scss");
    const result = sass.compile(file, { sourceMap });
    const sourceMappingURL = result.sourceMap ? `\n/*# sourceMappingURL=${name}.css.map */` : "";
    fs.writeFileSync(file.replace(/\.scss$/, ".css"), result.css + sourceMappingURL);
    if (result.sourceMap) fs.writeFileSync(file.replace(/\.scss$/, ".css.map"), JSON.stringify(result.sourceMap));
});