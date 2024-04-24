const { access, mkdir, readdir, writeFile } = require("fs/promises");
const { promisify } = require("util");
const Vibrant = require("node-vibrant");
const exifr = require("exifr");

const getFileList = async (dirName) => {
  let files = [];
  const items = await readdir(dirName, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      files = [...files, ...(await getFileList(`${dirName}/${item.name}`))];
    } else {
      files.push(`${dirName}/${item.name}`);
    }
  }
  return files;
};

const buildPhotoData = async () => {
  const input = process.argv[2] && process.argv[2].replace("--input=", "");
  const output = process.argv[3] && process.argv[3].replace("--output=", "");

  if (!input) {
    console.error(
      "You must define an initial input directory.\nYou can add `--input=path-to-photos` to your command"
    );
    return;
  }

  if (output) {
    access(output).catch(() => mkdir(output, { recursive: true }));
  }

  const files = await getFileList(input).then((files) =>
    files.filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
  );

  const arr = [];

  for (const file of files) {
    const palette = await Vibrant.from(file)
      .maxColorCount(256)
      .getSwatches()
      .then((palette) => {
        const paletteObj = {};
        for (let color in palette) {
          const colorName = color.toLowerCase();
          const hsl = palette[color].getHsl().map((i) => Math.round(i * 100));
          paletteObj[colorName] = {
            colorArray: hsl,
            colorString: `${hsl[0]}deg ${hsl[1]}% ${hsl[2]}%`
          };
        }
        return paletteObj;
      });

    const exifOptions = [
      "Make",
      "Model",
      "CreateDate",
      "FNumber",
      "ISO",
      "FocalLength"
    ];

    const exif = await exifr.parse(file, exifOptions);

    arr.push({
      directory: file.split("/")[1],
      file: file,
      palette: palette,
      exif: exif
    });
  }
  writeFile(`${output || "."}/photoData.json`, JSON.stringify(arr, null, 2));
};

buildPhotoData();
