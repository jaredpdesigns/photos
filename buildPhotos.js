require("dotenv").config();
const { access, mkdir, readdir, readFile, writeFile } = require("fs/promises");
const { promisify } = require("util");
const contentful = require("contentful-management");
const exifr = require("exifr");
const Vibrant = require("node-vibrant");
const existing = require("./src/data/photoData.json");

const client = contentful.createClient(
  {
    accessToken: process.env.CTF_CDA_ACCESS_TOKEN
  },
  { type: "plain" }
);

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
    const fileNameCleaned = file.split("/").pop().replace(".jpeg", "");
    const existingData = existing.find((img) =>
      img.file.includes(fileNameCleaned)
    );
    if (!existingData) {
      const fileLoaded = await readFile(file);
      const upload = await client.upload
        .create(
          {
            spaceId: process.env.CTF_SPACE_ID,
            environmentId: "master"
          },
          {
            file: fileLoaded
          }
        )
        .then((uploadedFile) =>
          client.asset.create(
            {
              spaceId: process.env.CTF_SPACE_ID,
              environmentId: "master"
            },
            {
              fields: {
                title: {
                  "en-US": fileNameCleaned
                },
                file: {
                  "en-US": {
                    contentType: "application/jpeg",
                    fileName: file,
                    uploadFrom: {
                      sys: {
                        type: "Link",
                        linkType: "Upload",
                        id: uploadedFile.sys.id
                      }
                    }
                  }
                }
              }
            }
          )
        )
        .then((createdAsset) =>
          client.asset.processForLocale(
            {
              spaceId: process.env.CTF_SPACE_ID,
              environmentId: "master"
            },
            createdAsset,
            "en-US"
          )
        );
      const publish = await client.asset.publish(
        {
          spaceId: process.env.CTF_SPACE_ID,
          environmentId: "master",
          assetId: upload.sys.id
        },
        upload
      );
      const fileName = await upload.fields.file["en-US"].url;
      console.log(`⬆️ Uploaded: https${fileName}`);

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
      console.log("🎨 Extracted palette");

      const exifOptions = [
        "CreateDate",
        "FNumber",
        "FocalLength",
        "ISO",
        "Make",
        "Model",
        "OffsetTime"
      ];

      const exif = await exifr.parse(file, exifOptions);

      console.log("📷 Extracted exif data");

      arr.push({
        directory: file.split("/")[1],
        file: `https:${fileName}`,
        palette: palette,
        exif: exif
      });
    } else {
      arr.push(existingData);
    }
  }
  writeFile(`${output || "."}/photoData.json`, JSON.stringify(arr, null, 2));
  console.log(`🖼️ Built ${arr.length} photos`);
};

buildPhotoData();
