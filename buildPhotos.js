import "dotenv/config";
import { access, mkdir, readdir, readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import exifr from "exifr";

const require = createRequire(import.meta.url);
const { Vibrant } = require("node-vibrant/node");

/*
 * Build photo data script - processes local images and uploads to R2
 * Usage: node buildPhotos.js --input=imgsToProcess/album-name --output=src/_data
 *
 * This will process all images in the input directory and create album-name.json
 *
 * Required environment variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - R2_PUBLIC_URL
 */

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

/**
 * Upload file to R2 bucket
 */
const uploadToR2 = async (buffer, key, contentType = "image/jpeg") => {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3Client.send(command);
};

/**
 * Generate R2 public URL
 */
const getR2PublicUrl = (key) => {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
};

/**
 * Recursively get all files in a directory
 */
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

/**
 * Main build function
 */
const buildPhotoData = async () => {
  const input = process.argv[2] && process.argv[2].replace("--input=", "");
  const output = process.argv[3] && process.argv[3].replace("--output=", "");
  const dryRun = process.argv.includes("--dry-run");

  if (!input) {
    console.error(
      "You must define an initial input directory.\nYou can add `--input=path-to-photos` to your command"
    );
    return;
  }

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be uploaded\n");
  }

  if (output) {
    access(output).catch(() => mkdir(output, { recursive: true }));
  }

  /* Get directory name from input path */
  const directory = input.split("/").pop();

  /* Get all files, excluding hidden files, and sort them */
  const files = await getFileList(input).then((files) =>
    files.filter((item) => !/(^|\/)\.[^\/\.]/g.test(item)).sort()
  );

  const arr = [];
  let photoNumber = 1;

  for (const file of files) {
    const fileLoaded = await readFile(file);

    /* Generate sequential filename */
    const paddedNumber = String(photoNumber).padStart(5, "0");
    const newFileName = `img_${
      directory.split("-")[0]
    }_${directory}-${paddedNumber}.jpeg`;
    photoNumber++;

    const r2Key = `${directory}/${newFileName}`;

    /* Upload to R2 (or simulate in dry run) */
    if (!dryRun) {
      await uploadToR2(fileLoaded, r2Key);
    }
    const fileUrl = getR2PublicUrl(r2Key);
    console.log(`${dryRun ? "🔍 Would upload" : "⬆️  Uploaded"}: ${fileUrl}`);

    /* Extract color palette */
    const swatches = await Vibrant.from(file).maxColorCount(256).getPalette();
    const paletteObj = {};
    for (let color in swatches) {
      if (swatches[color]) {
        const colorName = color.toLowerCase();
        const hsl = swatches[color].hsl.map((i) => Math.round(i * 100));
        paletteObj[colorName] = {
          colorArray: hsl,
          colorString: `${hsl[0]}deg ${hsl[1]}% ${hsl[2]}%`
        };
      }
    }
    const palette = paletteObj;
    console.log("🎨 Extracted palette");

    /* Extract EXIF data */
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
      directory: directory,
      file: fileUrl,
      palette: palette,
      exif: exif
    });
  }

  /* Write album JSON file */
  const outputDir = output || ".";
  const outputFile = `${outputDir}/${directory}.json`;

  if (!dryRun) {
    await writeFile(outputFile, JSON.stringify(arr, null, 2));
    console.log(`\n✅ Wrote ${arr.length} photos to ${directory}.json`);
  } else {
    console.log(
      `\n🔍 DRY RUN COMPLETE - Would have processed ${arr.length} photos`
    );
    console.log(`📄 Would create: ${directory}.json`);
    console.log(`\n📄 Preview of first entry:`);
    console.log(JSON.stringify(arr[0], null, 2));
  }
};

buildPhotoData();
