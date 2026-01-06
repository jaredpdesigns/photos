import "dotenv/config";
import { access, mkdir, readdir, readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import exifr from "exifr";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { Vibrant } = require("node-vibrant/node");

/*
 * Build photo data script - processes local images and uploads to R2
 * Usage: node buildPhotos.js [--dry-run] [--album=album-name] [--rewrite]
 *
 * This will automatically process all albums in imgsToProcess/ directory
 * and create corresponding JSON files in src/_data/
 *
 * Options:
 * --dry-run: Preview what would happen without uploading
 * --album=album-name: Process only a specific album folder
 * --rewrite: Force re-upload and re-process all photos (even if already processed)
 *
 * By default, the script will skip photos that have already been processed
 * and exist in the JSON file.
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
 * Process a single album directory
 */
const processAlbum = async (directory, inputDir, outputDir, dryRun, rewrite) => {
  console.log(`\n📸 Processing album: ${directory}`);
  console.log("━".repeat(50));

  const inputPath = `${inputDir}/${directory}`;
  const outputFile = `${outputDir}/${directory}.json`;

  /* Load existing JSON data if it exists (unless rewrite flag is set) */
  let existingData = [];
  let existingUrls = new Set();

  if (!rewrite) {
    try {
      const existingContent = await readFile(outputFile, "utf-8");
      existingData = JSON.parse(existingContent);
      existingUrls = new Set(existingData.map((item) => item.file));

      if (existingData.length > 0) {
        console.log(`📋 Found existing data with ${existingData.length} photo(s)`);
      }
    } catch {
      /* No existing file, that's fine */
    }
  } else if (!dryRun) {
    console.log("🔄 Rewrite mode: will re-process all photos");
  }

  /* Get all files, excluding hidden files, and sort them */
  const files = await getFileList(inputPath).then((files) =>
    files.filter((item) => !/(^|\/)\.[^\/\.]/g.test(item)).sort()
  );

  if (files.length === 0) {
    console.log(`⚠️  No images found in ${directory}, skipping...\n`);
    return;
  }

  const arr = [...existingData];
  let photoNumber = 1;
  let processedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    /* Generate sequential filename */
    const paddedNumber = String(photoNumber).padStart(5, "0");
    const newFileName = `img_${
      directory.split("-")[0]
    }_${directory}-${paddedNumber}.jpeg`;
    photoNumber++;

    const r2Key = `${directory}/${newFileName}`;
    const fileUrl = getR2PublicUrl(r2Key);

    /* Skip if already processed (unless rewrite mode) */
    if (!rewrite && existingUrls.has(fileUrl)) {
      console.log(`⏭️  Skipping (already processed): ${fileUrl}`);
      skippedCount++;
      continue;
    }

    try {
      /* Process the photo */
      const fileLoaded = await readFile(file);

      /* Upload to R2 (or simulate in dry run) */
      if (!dryRun) {
        await uploadToR2(fileLoaded, r2Key);
      }
      console.log(`${dryRun ? "🔍 Would upload" : "⬆️  Uploaded"}: ${fileUrl}`);

      /*
       * Extract color palette
       * Create a smaller version of the image for color extraction to avoid memory issues
       * We only need a small sample to get accurate colors
       */
      const thumbnailBuffer = await sharp(file)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const swatches = await Vibrant.from(thumbnailBuffer).maxColorCount(256).getPalette();
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

      /* Add to array (or replace if rewriting) */
      if (rewrite) {
        const existingIndex = arr.findIndex((item) => item.file === fileUrl);
        if (existingIndex >= 0) {
          arr[existingIndex] = {
            directory: directory,
            file: fileUrl,
            palette: palette,
            exif: exif
          };
        } else {
          arr.push({
            directory: directory,
            file: fileUrl,
            palette: palette,
            exif: exif
          });
        }
      } else {
        arr.push({
          directory: directory,
          file: fileUrl,
          palette: palette,
          exif: exif
        });
      }

      processedCount++;

      /*
       * Save progress after each photo (incremental save)
       * This ensures we don't lose work if processing fails partway through
       */
      if (!dryRun) {
        await writeFile(outputFile, JSON.stringify(arr, null, 2));
      }
    } catch (error) {
      console.error(`\n❌ Error processing ${file}:`);
      console.error(error.message);
      console.error(`\n💾 Progress saved. ${processedCount} photo(s) successfully processed.`);
      console.error(`   You can re-run the command to continue from where it left off.\n`);
      throw error;
    }
  }

  /* Write album JSON file */
  if (!dryRun) {
    await writeFile(outputFile, JSON.stringify(arr, null, 2));
    console.log(`\n✅ Wrote ${arr.length} photos to ${outputFile}`);
    if (skippedCount > 0) {
      console.log(`   ⏭️  Skipped ${skippedCount} already processed photo(s)`);
    }
    if (processedCount > 0) {
      console.log(`   ✨ Processed ${processedCount} new photo(s)`);
    }
  } else {
    console.log(
      `\n🔍 DRY RUN COMPLETE - Would have processed ${processedCount} photo(s)`
    );
    if (skippedCount > 0) {
      console.log(`   ⏭️  Would skip ${skippedCount} already processed photo(s)`);
    }
    console.log(`📄 Would create/update: ${outputFile}`);
    if (arr.length > 0) {
      console.log(`\n📄 Preview of first entry:`);
      console.log(JSON.stringify(arr[0], null, 2));
    }
  }
};

/**
 * Main build function
 */
const buildPhotoData = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const rewrite = args.includes("--rewrite");
  const specificAlbum = args
    .find((arg) => arg.startsWith("--album="))
    ?.replace("--album=", "");

  const inputDir = "imgsToProcess";
  const outputDir = "src/_data";

  /* Ensure output directory exists */
  await access(outputDir).catch(() => mkdir(outputDir, { recursive: true }));

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be uploaded\n");
  }

  if (rewrite && !dryRun) {
    console.log("🔄 REWRITE MODE - Will re-process all photos\n");
  }

  /* Check if input directory exists */
  try {
    await access(inputDir);
  } catch {
    console.error(
      `❌ Input directory '${inputDir}' does not exist. Please create it and add album folders with images.`
    );
    return;
  }

  /* Get all album directories */
  const items = await readdir(inputDir, { withFileTypes: true });
  const albums = items
    .filter((item) => item.isDirectory() && !item.name.startsWith("."))
    .map((item) => item.name);

  if (albums.length === 0) {
    console.log(
      `📂 No album folders found in ${inputDir}/\n\nTo use this script, create folders in ${inputDir}/ with your photos.`
    );
    return;
  }

  /* Process specific album or all albums */
  if (specificAlbum) {
    if (!albums.includes(specificAlbum)) {
      console.error(
        `❌ Album '${specificAlbum}' not found in ${inputDir}/\n\nAvailable albums: ${albums.join(", ")}`
      );
      return;
    }
    await processAlbum(specificAlbum, inputDir, outputDir, dryRun, rewrite);
  } else {
    console.log(`📂 Found ${albums.length} album(s) to process:`);
    albums.forEach((album) => console.log(`   • ${album}`));

    for (const album of albums) {
      await processAlbum(album, inputDir, outputDir, dryRun, rewrite);
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✨ All done! Processed ${albums.length} album(s)`);
  }
};

buildPhotoData();
