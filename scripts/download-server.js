#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const args = process.argv.slice(2);
const targetPlatform = args[0];

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Определяем версию сервера
const SERVER_VERSION = packageJson.stack?.serverVersion || packageJson.version;
const SERVER_REPO = "Stonum/stack-lang-server";
const GITHUB_API = "https://api.github.com";
const GITHUB_RELEASES = `https://github.com/${SERVER_REPO}/releases/download`;

// Маппинг платформ
const platformMapping = {
   win32: {
      name: "windows",
      asset: `stack-lang-server-win32-x64.exe`,
      isWindows: true,
   },
   linux: {
      name: "linux",
      asset: `stack-lang-server-linux-x64`,
      isWindows: false,
   },
};

function getPlatformConfig() {
   const platform = targetPlatform || process.platform;

   const config = platformMapping[platform];
   if (!config) {
      console.error(`❌ Unsupported platform: ${platform}`);
      console.error(
         `Supported platforms: ${Object.keys(platformMapping).join(", ")}`,
      );
      process.exit(1);
   }

   return config;
}

function ensureDirectory(dirPath) {
   if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dirPath}`);
   }
}

function downloadFile(url, outputPath) {
   return new Promise((resolve, reject) => {
      console.log(`⬇️  Downloading: ${url}`);
      console.log(`   → ${outputPath}`);

      const request = https.get(url, (response) => {
         // Обработка редиректов
         if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            console.log(`   ↪ Redirecting to: ${redirectUrl}`);
            downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
            return;
         }

         if (response.statusCode !== 200) {
            reject(
               new Error(
                  `HTTP ${response.statusCode}: ${response.statusMessage}`,
               ),
            );
            return;
         }

         const fileStream = fs.createWriteStream(outputPath);
         let downloadedSize = 0;
         const totalSize = parseInt(response.headers["content-length"], 10);

         response.pipe(fileStream);

         response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize) {
               const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
               process.stdout.write(
                  `\r   Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`,
               );
            }
         });

         fileStream.on("finish", () => {
            fileStream.close();
            console.log("\n   ✅ Download complete");
            resolve(outputPath);
         });

         fileStream.on("error", (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
         });
      });

      request.on("error", reject);
      request.setTimeout(60000, () => {
         request.destroy();
         reject(new Error("Download timeout after 60 seconds"));
      });
   });
}

async function downloadServer() {
   console.log("🚀 Stack Language Server Downloader");
   console.log("====================================");
   console.log(`📦 Version: ${SERVER_VERSION}`);
   console.log(`🖥️  Platform: ${process.platform} (${process.arch})`);
   console.log(`📂 Repository: ${SERVER_REPO}`);
   console.log("");

   // Проверяем версию
   if (!SERVER_VERSION || SERVER_VERSION === "0.0.0") {
      console.error("❌ Invalid version. Please set version in package.json");
      process.exit(1);
   }

   const platformConfig = getPlatformConfig();
   const serverBinDir = path.join(__dirname, "..", "server-bin");

   // Создаем директорию для бинарников
   ensureDirectory(serverBinDir);

   const assetName = platformConfig.asset;
   const outputPath = path.join(serverBinDir, assetName);

   // Проверяем, существует ли уже файл
   if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 0) {
         console.log(`ℹ️  Server binary already exists: ${outputPath}`);
         console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
         console.log("✅ Skipping download");
         return outputPath;
      } else {
         console.log("⚠️  Existing file is empty, re-downloading...");
         fs.unlinkSync(outputPath);
      }
   }

   // Формируем URL для скачивания
   const downloadUrl = `${GITHUB_RELEASES}/v${SERVER_VERSION}/${assetName}`;

   try {
      console.log(`🔍 Checking release v${SERVER_VERSION}...`);

      // Сначала проверяем, существует ли релиз
      const releaseCheckUrl = `${GITHUB_API}/repos/${SERVER_REPO}/releases/tags/v${SERVER_VERSION}`;
      await new Promise((resolve, reject) => {
         https
            .get(
               releaseCheckUrl,
               { headers: { "User-Agent": "Node.js" } },
               (res) => {
                  if (res.statusCode === 404) {
                     reject(
                        new Error(
                           `Release v${SERVER_VERSION} not found in ${SERVER_REPO}`,
                        ),
                     );
                  } else if (res.statusCode === 200) {
                     resolve();
                  } else {
                     reject(new Error(`GitHub API returned ${res.statusCode}`));
                  }
               },
            )
            .on("error", reject);
      });

      console.log(`✅ Release v${SERVER_VERSION} exists`);
      console.log("");

      // Скачиваем файл
      await downloadFile(downloadUrl, outputPath);

      // Делаем исполняемым на Unix-системах
      if (!platformConfig.isWindows) {
         fs.chmodSync(outputPath, "755");
         console.log("🔧 Made executable");
      }

      console.log("");
      console.log(`✅ Server downloaded successfully!`);
      console.log(`   📁 ${outputPath}`);
      console.log(
         `   Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)}MB`,
      );

      return outputPath;
   } catch (error) {
      console.error("");
      console.error("❌ Download failed:", error.message);
      console.error("");
      console.error("Possible solutions:");
      console.error(`  1. Check that release v${SERVER_VERSION} exists:`);
      console.error(
         `     https://github.com/${SERVER_REPO}/releases/tag/v${SERVER_VERSION}`,
      );
      console.error(`  2. Check your internet connection`);
      console.error(`  3. Try again later`);
      console.error("");
      console.error(`To manually download the server:`);
      console.error(`  ${downloadUrl}`);
      process.exit(1);
   }
}

// Экспортируем для использования как модуль
module.exports = { downloadServer, getPlatformConfig };

// Если запускаем как скрипт
if (require.main === module) {
   downloadServer().catch((error) => {
      console.error("❌ Fatal error:", error.message);
      process.exit(1);
   });
}
